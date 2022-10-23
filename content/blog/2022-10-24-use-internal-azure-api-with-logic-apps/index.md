---
title: 'Use internal main.iam.ad API with Logic Apps'
description: In this blog, I show how to use the Azure hidden API (main.iam.ad) with Logic Apps. I show how to get Microsoft licenses to an overview with display names that are not available in the Graph API. 
date: 2022-10-17T11:46:12+02:00
author: 'Sander Rozemuller'
image: logic-app-design-thumbnail.png
categories:
    - "Azure AD"
    - API
tags:
    - Security
    - Monitoring
type: "regular"
url: use-internal-azure-api-with-logic-apps
---
This blog post is a follow-up to [my post about using the hidden API in automation](https://www.rozemuller.com/use-internal-azure-api-in-automation/). In that post, I explained how to authenticate to the ```https://main.iam.ad.ext.azure.com/api/``` endpoint and, how to get information from it. 
I used Azure Functions to run the automation tasks. 

In this blog post, I show how to get the same license information using Logic Apps. 
If you haven't already, I would suggest reading that post first. I will skip the [authentication](https://www.rozemuller.com/use-internal-azure-api-in-automation/#authenticate-to-mainiamadextazurecom), Key Vault setup and [store the initial refresh token](https://www.rozemuller.com/use-internal-azure-api-in-automation/#store-refresh-token-in-azure-key-vault) parts. 

{{< toc >}}

## Create Logic App
At first, we need a Logic App. After the Logic App is created the Key Vault Secrets Officer role is assigned to the system identity. To assign the correct role please check the part [assign the correct roles](https://www.rozemuller.com/use-internal-azure-api-in-automation/#create-and-assign-the-system-identity-to-key-vaults-secrets-officer) from my other blog post. 

```powershell

```

{{< bye >}}