---
title: "Dynamically Restricting Local Logon to the Primary User on Intune-Managed Windows Devices"
author: Sander Rozemuller
date: 2025-11-20T12:00:00+02:00
images:
  - "images/post/dynamically-restricting-local-logon/image.jpeg"
url: "dynamically-restricting-local-logon-to-the-primary-user-on-intune-managed-windows-devices"
categories:
- Intune
- Windows
tags:
- Automation
- PowerShell
---

In many organisations, Windows devices move between users during onboarding and offboarding processes. Autopilot assigns a **Primary User**, but Windows itself does not prevent other Azure AD users from signing in to that same device. The result is a common and recurring problem:  
a device ends up being used by someone it was not intended for.

At first glance, Intune seems to offer a solution. The *Allow log on locally* user right can be configured through an Account Protection policy. However, this setting is static. It cannot adapt per device and does not understand the concept of “Primary User”. That means that you have to create a policy for every device and configure the primary user in that policy. 
Not that scalable :).

This led me into a deep dive into Windows logon rights, how Azure AD identities are represented on the device, and what actually happens during Autopilot and OOBE sign-ins. Eventually, this research resulted in a dynamic and safe solution: allow the Autopilot Primary User and administrators, and block everyone else.

Before getting there, we need to understand how Windows decides who can log in at all.

{{< toc >}}

## In short
Intune provides a setting called `Allow local log on`, but it is static. You have to fill every SID or UPN that is allowed to log in to that machine.
It cannot dynamically enforce that only the Autopilot Primary User (and administrators such as LAPS) may sign in.

Why not?

- Azure AD users do not have a SID on the device until after their first login.
- Logon rights in Windows require SIDs, not UPNs.
- The first Autopilot OOBE login bypasses logon rights entirely.
- Intune cannot insert the correct user SID per device dynamically.
- Deny policies are dangerous and can easily lock out all users.

This blog explains how Windows handles identity, SIDs, logon rights, and the Autopilot login sequence.
From there, we build a safe, dynamic solution:

- Intune deploys a baseline policy allowing only administrators to log in.
- After OOBE, the device learns who the Primary User is and generates their SID.
- A Proactive Remediation script detects the Primary User locally.
- The script uses secedit to update Allow log on locally with the Primary User SID.
- From the second login onward, Windows enforces that only the Primary User and administrators may sign in.

This approach prevents unwanted users from logging in to devices they should not use,
while keeping Autopilot, LAPS, and administrator access fully functional.

To understand why restricting local logon for Azure AD users is challenging, we must first look at how Windows internally handles identities and logon rights.

## Security Identifiers (SIDs)
Every identity in Windows—local users, groups, service accounts, domain users—has a **Security Identifier (SID)**. The SID is the actual identifier Windows uses everywhere: for ACLs, privileges, and logon rights.

Even if you configure a setting using a username, Windows always converts it to a SID before storing it internally.

Azure AD identities work differently:

- A local account has a SID immediately.
- A domain account has a SID retrieved from a domain controller.
- An Azure AD user has **no SID** on the device until after their first successful login.

This is because Azure AD is not a domain. The SID is not stored anywhere locally and cannot be retrieved without a login.

## How Windows stores logon rights
Logon rights such as:

- Allow log on locally  
- Deny log on locally  
- Allow log on through Remote Desktop Services  

are stored in the **Local Security Authority (LSA)** policy store, part of the SECURITY hive:

```
HKLM\SECURITY\Policy
```

Entries are stored as SIDs.  
Unknown identities (identities without a SID yet) cannot be evaluated.

## What happens during the first Azure AD login
When an Azure AD user signs in to a device for the first time:

1. The user authenticates via CloudAP.
2. Azure AD returns the user’s Object ID (GUID).
3. The device generates an Azure AD SID:  
   `S-1-12-1-<hashed-object-id>`
4. LSA stores the SID.
5. A local profile is created.

This means Windows only learns the SID of an Azure AD user **after** the first successful sign-in.
This point becomes crucial later when we talk about enforcement.

## Why This is a Problem for Restricting Logon
Given that Windows requires SIDs for evaluating logon rights, and Azure AD users have no SID until after logging in, several issues arise.

### Intune’s User Rights CSP expects SIDs
The Account Protection profile in Intune allows you to configure *Allow log on locally*.  
Intune writes these values into LGPO and the LSA policy store.

However:

- It cannot dynamically insert each device’s Primary User.
- It cannot convert a UPN to a SID on its own.
- It cannot adapt policies per device.

Intune’s system is **static**, while the requirement is **dynamic**.

### Deny rights are dangerous
Some administrators (like me) try to block unwanted users using Deny rights such as:

```
SeDenyInteractiveLogonRight
```

This backfires on Azure AD Joined devices because:

- Deny rights are evaluated first.
- Azure AD user SIDs often do not exist early in logon.
- Deny rules can accidentally match broad groups.
- This can lock out *all* Azure AD users, including the Primary User.

During testing, deny rules caused complete device lockouts multiple times.

That could be a very good reason why this is also not an option in the settings catalog.

![no-deny](./no_deny.jpg)

### OOBE Login is special
Even if the device already has a restrictive policy applied, the first user login during OOBE **always bypasses local user rights**.

This is by design:

- The SID does not exist yet.
- The profile does not exist yet.
- CloudAP must create the identity.
- LSA cannot evaluate rights for unknown users.

If Windows enforced local logon rights during OOBE, Autopilot would be impossible.
So even with:

```
Allow log on locally = Administrators only
```

the OOBE login for the Primary User will still succeed.

This is expected and required behaviour.

## What Intune Does (and Does Not) Control
Intune participates in this process, but it does **not** control user sign-in during OOBE.

- During Device ESP : Intune delivers device-targeted policies, including User Rights.
- During User OOBE  : Windows ignores User Rights Policies.
- After first login : Windows enables LSA privilege checks, and Intune-configured logon rights become active.

Because Intune cannot dynamically insert the Primary User into the logon rights and because OOBE ignores the policy anyway, Intune alone cannot enforce “Primary User only”.

This is where automation comes in.

# The Desired Behaviour
With the fundamentals and constraints understood, the goal becomes clear:

- Allow the Autopilot Primary User to sign in.  
- Allow administrators, including the LAPS local admin.  
- Deny all other Azure AD users.  
- Avoid deny-right lockouts.  
- Apply the restriction dynamically after OOBE.  
- No per-device policies.

Now we can build a solution that respects Windows identity behaviour and Intune’s limitations.

## Solution Architecture
The final solution consists of three layers.
- Intune configuration policy with `Allow Local Log On` set to administrators only (*S-1-5-32-544);
- Intune detection script that check the current Windows security database;
- Intune remediation script that changes the Windows security database with the primary user;

### Intune configuration policy
Configure a device-targeted configuration policy:

```
SeInteractiveLogonRight = *S-1-5-32-544
```

This ensures:

- Local administrators can always sign in.
- LAPS can always sign in.
- The device will not lock itself out.

This policy arrives during Device ESP but is not enforced during OOBE.

![allow-logon](./allow-logon.png)

### Dynamic Local Enforcement with Proactive Remediation
After the Primary User completes OOBE and logs in for the first time:

- Their SID is generated and available at the Windows device;
- The device can evaluate user rights properly;
- Now we enforce the restriction dynamically;

That allows us to run the detection script on the machine that does the following tasks:

- Reads the current available UPN's and SID using the Identity Cache;
- Resolves the SID if available;
- Falls back to the UPN if SID does not yet exist;
- Checks if there is still only one user;

The remediation script on his turn has the following tasks:
- Checks again if the device still has one user;
- Generates a minimal security template;
- Applies it using secedit;

From this point onward, only the Primary User and administrators can sign in.

### Enforcement begins after OOBE where the first login took place
On the second login:

- SID exists
- LSA evaluates rights
- Other users are denied
- Administrators and LAPS are still allowed

This creates the exact behaviour we want.

## Deep Dive: How the detection and remediation works
In the part, I will explain the key components of the scripts.

### Detect: all AAD identities on the device (IdentityStore)
This part scans the IdentityStore\Cache registry and returns all unique Azure AD UPNs that have an identity cache on the device. In practice, these are all AAD users that have signed in interactively at least once. 
When targeting the script at device level, the detection will run immediately after OOBE where no other users had time to login, so there is only one user that is the primary user.

```powershell
function Get-DeviceUserIdentities {
    $cacheRoot = "HKLM:\SOFTWARE\Microsoft\IdentityStore\Cache"
    $userNames = @()

    Get-ChildItem -Path $cacheRoot -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.PSPath -like '*IdentityCache*' } |
        ForEach-Object {
            try {
                $props = Get-ItemProperty -Path $_.PSPath -ErrorAction Stop

                if ($props.PSObject.Properties.Name -contains 'UserName') {
                    $u = $props.UserName
                    if ($u -and $u -like '*@*') {
                        $userNames += $u
                    }
                }
            } catch { }
        }

    $userNames | Select-Object -Unique
}
```

### Detect: Safety guard, only treat single-identity devices as “Primary User devices”
Safety first when it becomes to user login in. You don't want to lock the device or point the device to the wrong user. 
To avoid locking out legitimate users on shared or reused devices, the script only enforces the “primary user only” restriction when exactly one Azure AD identity is present. If there are zero or multiple identities, it skips enforcement.

```powershell
$upns = Get-DeviceUserIdentities

if (-not $upns -or $upns.Count -eq 0) {
    Write-Output "No AAD users found - skip enforcement."
    return
}

if ($upns.Count -gt 1) {
    Write-Output "Multiple AAD users found on this device: $($upns -join ', ')."
    Write-Output "Treat device as shared / ambiguous - skip enforcement."
    return
}

$upn = $upns[0]
Write-Output "Single AAD user detected: $upn (treating as primary)."

```

### Detect: Export and read the current local security policy
`ExportPolicy` exports the effective local security policy to a temporary file using secedit /export. 
`GetRight` then parses that file and extracts the configured values for a specific user right, such as SeInteractiveLogonRight.

```powershell
function ExportPolicy {
    $cfg = Join-Path $env:TEMP "secpol_detect.cfg"
    secedit /export /cfg $cfg | Out-Null
    Get-Content $cfg -Raw
}

function GetRight($Cfg, $Name) {
    if ($Cfg -match "(?m)^$Name\s*=\s*(.*)$") {
        ($Matches[1] -split ',') |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    }
    else {
        @()
    }
}
```

### Detect: Compare SeInteractiveLogonRight to the expected set
This part builds the expected SeInteractiveLogonRight value (Primary User + local Administrators), exports the current policy, and compares the two. 
If they match, the device is compliant; if not, the remediation script will need to fix it.

```powershell
function Normalize([string[]]$l) {
    $l |
        Where-Object { $_ -and $_.Trim() } |
        ForEach-Object { $_.Trim() } |
        Select-Object -Unique |
        Sort-Object
}

$primaryAccount = "AzureAD\$upn"
$adminGroupSid  = '*S-1-5-32-544'   # local Administrators

$allowExpected = Normalize @($primaryAccount, $adminGroupSid)

$cfgRaw   = ExportPolicy
$curAllow = Normalize (GetRight $cfgRaw 'SeInteractiveLogonRight')

if ( ($curAllow -join ';') -ieq ($allowExpected -join ';') ) {
    Write-Output "OK"
    exit 0
}

Write-Output "Mismatch"
exit 1
```

### Remediation
For remedation the first steps are the same, just to make sure. That meanse, the remediation script first checks the local identity cache (IdentityStore\Cache) again and collects all Azure AD UPNs that have logged on to the device. If there is exactly one identity, it treats that user as the effective “Primary User”. If there are zero or multiple identities, the script considers the device shared or ambiguous and skips enforcement to avoid lockouts.

### Remediate: Building the secedit INF for SeInteractiveLogonRight
This block constructs a minimal security template in INF format. It defines a single privilege right, `SeInteractiveLogonRight`, and sets it to two entries: the primary Azure AD user `(AzureAD\<UPN>) `and the local `Administrators group (*S-1-5-32-544)`. 
This combination ensures that only the Primary User and administrators (including LAPS) are allowed to log on locally.

```powershell
$primaryAccount = "AzureAD\$PrimaryUpn"
$adminGroupSid  = '*S-1-5-32-544'

$entries = Normalize @($primaryAccount, $adminGroupSid)

$infContent = @"
[Unicode]
Unicode=yes

[Version]
signature="\$CHICAGO\$"
Revision=1

[Privilege Rights]
SeInteractiveLogonRight = $($entries -join ',')
"@
```

### Remediate: Applying the template with secedit and set the Windows security database
The remediation writes the INF content to a temporary file and imports it into a temporary secedit database. The /configure step then applies the `USER_RIGHTS` area from this database to the local LSA policy store. At this point, Windows effectively enforces that only the Primary User and the local Administrators group are allowed to log on locally.
```powershell
$infPath = Join-Path $env:TEMP 'secpol_primaryuser.inf'
$dbPath  = Join-Path $env:TEMP 'secpol_primaryuser.sdb'

$infContent | Out-File -FilePath $infPath -Encoding ASCII -Force

secedit /import /db $dbPath /cfg $infPath /overwrite | Out-Null
secedit /configure /db $dbPath /areas USER_RIGHTS /quiet | Out-Null
```

The last step is checking for errors and if the configuration is really set.
```powershell
$cfgRaw      = ExportPolicy -Path $verifyCfg
    $curAllow    = Normalize (GetRight $cfgRaw 'SeInteractiveLogonRight')
    $expectedStr = $entries -join ';'
    $currentStr  = $curAllow -join ';'

    Write-Output "Verification - expected SeInteractiveLogonRight: $expectedStr"
    Write-Output "Verification - current  SeInteractiveLogonRight: $currentStr"

    if ($expectedStr -ine $currentStr) {
        throw "Verification failed: SeInteractiveLogonRight does not match expected value."
    }
```

# Conclusion

What started as a simple goal—only allow the Primary User and administrators to sign in—turned into a deeper journey through Windows identity architecture, Azure AD SID generation, and how Intune interacts with LSA policy.

The key takeaways:

- Azure AD users do not have SIDs until after first login.
- OOBE sign-in bypasses local logon rights entirely.
- Intune cannot dynamically target device-specific Primary Users.
- Deny rights on Azure AD Joined devices are risky.
- Secedit supports UPN placeholders and safely updates them later.
- A dynamic remediation provides the missing link.

The result is a robust, scalable, and safe way to ensure that each device is only used by the person it is assigned to, without locking out administrators or breaking Autopilot.

If you want a ready-to-import Proactive Remediation package or downloadable scripts, feel free to ask.
