---
title: "Dynamically Restricting Local Logon to the Primary User on Intune-Managed Windows Devices"
author: Sander Rozemuller
date: 2025-10-09T14:00:00+02:00
images:
  - "images/post/monitor-intune-managed-device-disk-space-with-powershell/image.jpg"
url: "dynamically-restricting-local-logon-to-the-primary-user-on-intune-managed-windows-devices"
categories:
- Intune
- Monitoring
tags:
- Automation
- PowerShell
- Graph API
---



When you assign Windows devices through Microsoft Intune, one of the common challenges is controlling who is allowed to sign in locally. This becomes especially relevant when devices are re-used across the organisation, for example during onboarding and offboarding cycles.

Intune provides User Rights Assignments such as Allow log on locally, but these policies are static. They require a fixed list of users or groups, and cannot dynamically adapt based on each device’s Autopilot Primary User. In practice this means you would need a separate policy per device per user, which is unmanageable at scale.

In this blog I walk through the internals of how Windows evaluates local logon rights for Azure AD users, how Azure AD SIDs are created, and how you can safely enforce “Only Primary User + LAPS Administrator can log in” without creating dozens of individual policies.

This includes the full flow, the scripts, and the reasoning behind each step.

The goal

My requirement was simple:

Allow the Autopilot Primary User to sign in.

Allow local administrators, including the LAPS account.

Block every other Azure AD user from signing in.

Do this without static Intune assignments per-device.

Ensure no risk of device lockout.

I wanted a fully dynamic, device-side solution that evaluates the Primary User and configures Windows accordingly.

Why not use deny policies?

The first idea is usually to work with SeDenyInteractiveLogonRight. This quickly leads to problems. Windows evaluates deny rights before allow rights. On Azure AD joined devices, these deny entries are dangerous: if you deny a broad group such as Authenticated Users or AzureAD Users, Windows can easily block all cloud users during sign-in, because their SIDs aren’t available early in the logon process.

In short: deny rights are unpredictable and can cause a full lockout.

Understanding Azure AD users and SIDs

A key part of this journey was understanding how Windows actually handles Azure AD accounts internally.

Azure AD users do not have a SID until first logon

Unlike on-prem Active Directory, Azure AD users do not have a pre-defined SID stored inside the device. Their SID is generated locally on the device, the first time that user successfully signs in.

During the first successful logon:

CloudAP (the Azure AD authentication provider) authenticates the user.

Azure AD returns the Object ID of the user.

Windows generates an Azure AD SID based on this Object ID.

This SID becomes the authoritative identifier for the user.

The SID looks like:

S-1-12-1-<hash-of-object-id>


This explains an important behaviour: when you configure Allow log on locally using AzureAD\user@domain.com, Windows cannot convert this into a SID until that user actually signs in.

Until then, Windows stores the plain username as a placeholder.

Why Windows accepts plain usernames in User Rights

Although Windows stores user rights as SIDs internally, it allows raw usernames to be stored temporarily. This is required to pre-authorise users who have never signed in before.

When you configure:

AzureAD\new.user@domain.com


for SeInteractiveLogonRight, Windows writes the string to the security policy even though no SID exists yet. When the user first signs in, CloudAP resolves the identity, the SID is generated, and Windows updates the internal policy automatically.

This behaviour allows us to pre-authorise the Primary User without locking the device.

The actual solution: only configure SeInteractiveLogonRight

Through testing, the simplest and most reliable solution turned out to be:

Only set SeInteractiveLogonRight with the Primary User and Administrators.

Do not configure any deny rights.

Let Windows fall back to the default deny behaviour for all other users.

This is both safe and predictable.

Windows interprets Allow log on locally as a whitelist when configured. Any user not listed is denied implicitly.

Example:

SeInteractiveLogonRight = <PrimaryUserSID>,*S-1-5-32-544


Where:

<PrimaryUserSID> is the Azure AD SID of the primary user

S-1-5-32-544 is the local Administrators group

This ensures:

Primary User: allowed

Local Administrators (including LAPS): allowed

Every other Azure AD user: denied automatically

No deny configurations are required.

Dynamically resolving the Primary User

The Primary User can be retrieved from the Autopilot provisioning registry:

HKLM:\SOFTWARE\Microsoft\Provisioning\Diagnostics\AutoPilot\CloudAssignedUserUpn


Using PowerShell, you can convert this UPN to a SID using the built-in .NET APIs:

$upn = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Provisioning\Diagnostics\AutoPilot').CloudAssignedUserUpn
$nt  = New-Object System.Security.Principal.NTAccount("AzureAD", $upn)
$sid = $nt.Translate([System.Security.Principal.SecurityIdentifier]).Value


Windows will only resolve the SID if the user has logged in before. If not, you simply write the UPN as a placeholder and Windows will replace it after the first login.

Applying the user right using secedit

A minimal INF template to configure Allow log on locally:

[Unicode]
Unicode=yes

[Version]
signature="$CHICAGO$"
Revision=1

[Privilege Rights]
SeInteractiveLogonRight = AzureAD\user@domain.com,*S-1-5-32-544


Apply it using:

secedit /import /db C:\Windows\Temp\rights.sdb /cfg C:\Windows\Temp\rights.inf
secedit /configure /db C:\Windows\Temp\rights.sdb /areas USER_RIGHTS /quiet


Use secedit again to verify:

secedit /export /cfg C:\Windows\Temp\rights_after.inf


After the first logon of that user, you will see the UPN replaced with the actual SID.

Cached logons and why tests can mislead you

During development I noticed that some users could still log in even when not allowed. This was caused by the Windows feature CachedLogonsCount.

By default, Windows caches up to 10 previous logons. A cached token allows a user to log in even after being removed from the allowed rights. To test user rights reliably, set:

CachedLogonsCount = 0


and reboot.

Why this approach works reliably

The final setup works because:

SeInteractiveLogonRight acts as a whitelist.

Azure AD users without SID are stored as UPN placeholders.

Windows replaces the UPN with the SID after first login.

Administrators remain allowed at all times.

No deny rules are required, removing the lockout risk.

No device-specific Intune policy assignments are needed.

The device remains usable, safe, and predictable.

Conclusion

Windows supports dynamic local logon control for Azure AD users, but only when you understand how Azure AD identities and SIDs actually work inside the LSA. The key is to avoid deny rights and rely solely on SeInteractiveLogonRight with the Primary User and Administrators.

With a small amount of automation through Proactive Remediations, each device can configure itself based on its assigned user during Autopilot enrollment without maintaining per-device Intune assignments.

This allows you to ensure that a device truly belongs to the Primary User and prevents unintended re-use without heavy administrative overhead.

If you want to extend this further, you can automate the SID resolution, create dynamic LGPO policies, or integrate it into a broader compliance flow. The behaviour remains consistent as long as you rely on the SID-based allow list.