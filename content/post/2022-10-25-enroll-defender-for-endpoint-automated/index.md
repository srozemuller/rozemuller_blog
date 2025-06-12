---
title: 'Enroll Defender For Endpoint automated'
description: I show in this blog how to monitor Intune using Azure Functions, PowerShell and Graph API. I explain why using Azure Functions, how to get information from the Graph API and how to send alerts.
date: 2022-09-28T09:12:46+02:00
author: 'Sander Rozemuller'
images:
- images/post/enroll-defender-for-endpoint-automated/dfe-protect-thumbnail.png
categories:
- "Microsoft Intune"
- 'Monitoring'
tags:
    - Microsoft Intune
    - Azure Functions
    - Graph API
    - PowerShell
type: "regular" # available types: [featured/regular]
url: monitor-intune-using-azure-functions-powershell-and-graph-api
draft: true
---



https://learn.microsoft.com/en-us/mem/intune/protect/advanced-threat-protection-configure

## Microsoft Intune Connection -> On

Find the if there is a connector already. Otherwise, create one.

```powershell
$url = "https://graph.microsoft.com/beta/deviceManagement/mobileThreatDefenseConnectors/fc780465-2017-40d4-a0c5-307022471b92"  #/fc780465-2017-40d4-a0c5-307022471b92
$request = Invoke-RestMethod -Uri $url -Method Get -Headers $authHeader
$request.value | ConvertTo-Json -Depth 9


$body = @{
  androidEnabled = $false
  iosEnabled = $false
  androidDeviceBlockedOnMissingPartnerData = $false
  iosDeviceBlockedOnMissingPartnerData = $false
  partnerUnsupportedOsVersionBlocked = $false
  windowsEnabled = $false
  partnerUnresponsivenessThresholdInDays = 6
} | ConvertTo-Json
$postRequest = Invoke-RestMethod -Uri $url -Method Patch -Headers $authHeader -Body $body
$postRequest
```

![available-dfe-connector.png](available-dfe-connector.png)


![dfe-enable-windows](dfe-enable-windows.png)