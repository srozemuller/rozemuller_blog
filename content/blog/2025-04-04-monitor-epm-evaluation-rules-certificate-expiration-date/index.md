---
title: "Monitor EPM Evaluation Rules Certificate Expiration"
author: Sander Rozemuller
date: 2025-04-04T15:45:49+02:00
images: 
  - image.jpeg
url: "manage-intune-scripts-with-github-actions"
categories:
- Intune
- Management
tags:
- Automation
- Graph API
- Intune
- GitHub
---

In the world of IT security, Endpoint Privilege Management (EPM) within Microsoft Intune plays a crucial role in ensuring that applications requesting elevated permissions are properly vetted. A key mechanism for this is the use of digital certificates in evaluation rules, which validate whether an application should be granted elevated access.

However, managing these certificates can be challenging. What happens when a certificate expires? If left unchecked, legitimate applications may lose their ability to function properly, leading to unnecessary disruptions and frustration for IT admins and end users.

By implementing this automation, you can ensure a smooth and secure environment while avoiding unnecessary downtime.

{{< toc >}}

# Monitoring EPM Intune Evaluation Certificates with PowerShell

This blog post walks you through a **PowerShell-based solution** to:

- Retrieve **EPM evaluation rules** from **Microsoft Intune**.
- Extract and analyze **certificate metadata**.
- Check for **expiring certificates**.
- Send proactive notifications via **Microsoft Teams** before a certificate expires.

By implementing this automation, you can ensure a smooth and secure environment while avoiding unnecessary downtime.

## How EPM Evaluation Rules Work

Before diving into the script, it's essential to understand how **EPM evaluation rules** function.

### What Are EPM Evaluation Rules?

EPM in Intune allows IT administrators to define policies that govern **which applications can request elevation**. These policies rely on different parameters, one of which is **a digital certificate** that verifies the application's identity.

Each application requesting elevation is checked against **evaluation rules** to determine whether it meets the organization's security standards. The **certificate plays a key role** in this decision-making process.

### Types of Certificates in EPM

1. **Reusable Certificates**: Can be used across multiple applications.
2. **Static Certificates**: Tied to a single application, requiring individual maintenance.

Since certificates have expiration dates, **monitoring them is critical** to prevent disruptions and security risks.

## Required Microsoft Graph API Permissions

To retrieve **EPM policies and certificates**, the script interacts with **Microsoft Graph API**. The following permissions are required:

- `DeviceManagementConfiguration.Read.All`
- `DeviceManagementConfiguration.ReadWrite.All` (if making changes)
- `DeviceManagementManagedDevices.Read.All`

Ensure that your **Azure AD application** or **admin account** has these permissions granted.


## Automating Certificate Monitoring with PowerShell

To automate the process of **checking certificate validity**, we use **PowerShell** in combination with the **Microsoft Graph API**.

### Step 1: Connecting to Microsoft Graph API

To interact with Intune and retrieve EPM policies, we need to **authenticate using Microsoft Graph**.

```powershell
try {
    if ($null -ne $GraphToken){
        Connect-MGGraph -AccessToken $GraphToken
    }
    else {
        Connect-MGGraph
    }
}
catch{
    Throw "Not able to connect to Graph API, $_"
}
```

This ensures that our script can securely communicate with Microsoft Intune.

### Step 2: Retrieving EPM Evaluation Rules

The script **fetches all configured EPM evaluation rules** from Intune.

```powershell
function GetEPMApplications(){
    Write-Verbose "Searching for application evaluation rules"
    $evaluationRuleFilter = 'Elevation rules policy'
    $evaluationRules = New-Object System.Collections.ArrayList

    $url = "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies?`$filter=templateReference/TemplateFamily%20eq%20'endpointSecurityEndpointPrivilegeManagement'&`$expand=settings"
    $response = Invoke-MgGraphRequest -Method GET -URI $url -OutputType PSObject
    $evaluationRules.Add(($response | Where-Object { $_.value.templatereference.templateDisplayName -eq $evaluationRuleFilter }).value) >> $null

    do {
        $url = $response.'@odata.nextLink'
        if ($null -ne $url){
            $response = Invoke-MgGraphRequest -Method GET -URI $url -OutputType PSObject | Where-Object { $_.value.templatereference.templateDisplayName -eq $evaluationRuleFilter}
            $evaluationRules.Add(($response | Where-Object { $_.value.templatereference.templateDisplayName -eq $evaluationRuleFilter }).value) >> $null
        }
    } while ($null -ne  $url)

    Write-Verbose "Found $($evaluationRules.Count) evaluation policies"
    return $evaluationRules
}
```

### Step 3: Extracting Certificate Details

To check a certificate's validity, we need to decode its metadata from **Base64** encoding.

```powershell
function GetCertInfo($base64String){
    $certBytes = [Convert]::FromBase64String($base64String)
    $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certBytes)

    return @{
        "Subject" = $($cert.Subject)
        "Issuer" = $($cert.Issuer)
        "Valid From" = $($cert.NotBefore)
        "Valid Until" = $($cert.NotAfter)
        "Thumbprint" = $($cert.Thumbprint)
    }
}
```

### Step 4: Checking Expiration and Sending Alerts

The script compares the **current date** with the certificate's expiration date and triggers an alert if it's about to expire.

```powershell
$now = Get-Date
$epmPolicies = GetEPMApplications
foreach ($epmEvaluation in $epmPolicies) {
    foreach ($config in $epmEvaluation.settings.settingInstance.groupSettingCollectionValue) {
        $certHashInfo = $config.children | Where-Object {($_.settingDefinitionId).EndsWith("_certificatefileupload")}
        $certInfo = GetCertInfo -base64String $certHashInfo.simpleSettingValue.value

        if ($now -gt ($certInfo."Valid Until").AddDays(-14)) {
            Write-Host "⚠️ Certificate expires in 14 days: $($certInfo."Valid Until")"
            Send-MsgToTeams -cert $certInfo -app $epmEvaluation
        } else {
            Write-Host "✅ Certificate is currently valid."
        }
    }
}
```

### Step 5: Sending a Notification to Microsoft Teams

If a certificate is nearing expiration, the script sends an **adaptive card** notification to a **Teams channel**.

```powershell
function Send-MsgToTeams($cert, $app){
    $cardBody = @"
    {
        "type":"message",
        "attachments":[
           {
              "contentType":"application/vnd.microsoft.card.adaptive",
              "contentUrl":null,
              "content":{
                 "`$schema":"http://adaptivecards.io/schemas/adaptive-card.json",
                 "type":"AdaptiveCard",
                 "version":"1.4",
                 "body":[
                     {
                     "type": "TextBlock",
                     "text": "Cert on EPM evaluation rule name $($app.name) expires in 14 days",
                     "wrap": true
                     }
                 ]
              }
           }
        ]
    }
"@
    Invoke-RestMethod -Method POST -Uri "https://YOUR_TEAMS_WEBHOOK_URL" -Body $cardBody -ContentType 'application/json'
}
```

---

## Conclusion

By implementing this **PowerShell-based solution**, IT admins can:
✅ **Proactively monitor** certificates in EPM policies.
✅ **Receive Teams alerts** before a certificate expires.
✅ **Avoid disruptions** due to expired certificates.

With this automation, you ensure that **elevation requests continue to work smoothly** without last-minute surprises.

{{< bye >}}