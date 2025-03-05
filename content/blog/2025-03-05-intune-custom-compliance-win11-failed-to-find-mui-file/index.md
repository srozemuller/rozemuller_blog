---
title: "Manage Intune Scripts With GitHub Actions"
author: Sander Rozemuller
date: 2025-02-12T15:45:49+02:00
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

Microsoft has released a nice feature called Administrator Protection. It is a new feature in Windows 11 that helps protecting the local administrator account. This feature is enabled by default on new installations of Windows 11. When you upgrade from Windows 10 to Windows 11, the feature is not enabled by default. This blog post will show you how to enable the Administrator Protection feature on Windows 11 devices.
However, without the correct Windows 11 language settings this new feature will not work. The error message you will see is: `The resource loader cache doesn’t have loaded MUI entry` or `The resource loader failed to find MUI file`.   
To avoid this issue, you need to set the correct language settings in Windows 11.  
This blog post will show you how to fix this issue using custom compliance scripts in Intune.

{{< toc >}}

## The idea
Because of the setting Administrator Protection is a great addition to you security layer, it is recommended to create an Intune policy that enables the feature. But, as mentioned, this policy can break things if the language settings are not correct. To avoid this, you can create a custom compliance script in Intune that checks the language settings on Windows 11 devices. 
So, we will create the policy and assign it to a device group. That device group only have devices that has the correct language settings. 
To determine if the language settings are correct, we will use a custom compliance script in Intune. This script will check the language settings on the device and will return a compliant or non-compliant status.
If a device is compliant the machine will be added to the assigned device group in an automated way. If the device is non-compliant, the device will be removed from the device group. 



You can find the script and the action in my repository: https://github.com/srozemuller/IntuneAutomation.

{{< bye >}}