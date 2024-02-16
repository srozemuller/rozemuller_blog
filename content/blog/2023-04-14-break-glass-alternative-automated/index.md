---
title: "Passwordless, Multi-layered Break Glass Alternative Automated"
author: Sander Rozemuller
date: 2023-04-14T09:15:27+02:00
image: image.jpg
draft: false
url: "passwordless-multilayered-break-glass-alternative-automated"
categories:
- Security
- Intune
- Zero Trust
tags:
- Automation
- Intune
- Graph API
- Zero to Zero Trust
---
Emergency accounts are a fundamental part of any security strategy. They are used to access systems when the primary account is unavailable or locked out. In the past, emergency accounts were often called “break glass” accounts. In an earlier post, I explained [how to create an emergency account based on a user account with a password](../configure-break-glass-accounts-infrastructure-automated/). In this post, I will show you how to automate the creation of a passwordless, multi-layered emergency account using Graph API. 
{{< toc >}}

## The idea
The idea is to log in with a service principal using a client certificate in the first place. With Zero Trust in mind, the principal has the minimal needed permissions that only allow adding users to an [Azure Role-enabled group](https://learn.microsoft.com/en-us/azure/active-directory/roles/groups-concept#how-are-role-assignable-groups-protected). 
The group is empty by default and assigned to the MFA Conditional Access policy exclusion list.  

In the case of an emergency, a person connects to the tenant using the service principal. After logging in, users are added to the exclusion group (layer 1).  
Thereafter, the person can log in using the user account as the emergency user (layer 2).

A big pro of this approach is that the emergency account is passwordless. Also, the emergency account is multi-layered. Even when the service principal is compromised, the attacker can only add users to the exclusion group and needs an extra existing user to log in. The attacker can’t change the Conditional Access policy.  
This is a major improvement over a single high-privileged break glass account with only a password.

## The setup
Assuming you already have a Conditional Access policy with MFA enabled, we need the following:
- A service principal with the following permissions:
    - RoleManagement.ReadWrite.Directory
    - Users.Read.All (optional), If you know the user object ID of the user you want to add to the exclusion group, you can skip this permission to find the user object id.

- A client certificate with key. Instead of using an application ID and secret, we will use a client certificate. This is more secure than using a secret.
- An empty <u>Azure Role-enabled</u> AD group that is assigned to the MFA Conditional Access policy exclusion list.

If you don't have a Conditional Access policy with MFA enabled, I would suggest reading my post [Protect Privileged Accounts the Zero Trust Way Automated](../protect-privileged-accounts-the-zero-trust-way-automated//).


## Client certificate
The first step is creating a client certificate. Several ways are available, I use OpenSSL to create a self-signed certificate with a private key. Creating a certificate consists of the following steps:
- Create a private key.
- Create a certificate signing request (CSR).
- Create a self-signed certificate.
- Convert the certificate to a PFX file.

### Create a private key
You can use the following command to create a private key.  
```powershell
openssl genrsa -des3 -out cert.key 2048
```

### Create a certificate signing request (CSR)
You can use the following command to create a CSR with the created private key from above.  
```powershell
openssl req -new -key cert.key -out cert.csr
```

### Create a self-signed certificate
You can use the following command to create a self-signed certificate using the request and private key. The created .crt file is the certificate and will be uploaded to the Azure AD application.  
```powershell
openssl x509 -signkey cert.key -in cert.csr -req -days 365 -out cert.crt
```

### Convert the certificate to a PFX file
You can use the following command to convert the certificate to a PFX file that contains the private key. This is the certificate that is used to log in with the service principal and distributed to a device.
Using a private key avoids that the certificate can be shared easily.  
```powershell
openssl pkcs12 -inkey cert.key -in cert.crt -export -out cert.pfx
```
For more information about creating a client certificate, see [Create a self signed certificate with OpenSSL](https://www.baeldung.com/openssl-self-signed-cert).

## Create an app registration
The next step is creating a service principal. In the following steps, I create the following:
- An app registration with the correct Graph API permissions
- A service principal based on the app registration
- An admin consent for the app registration
- Upload client certificate to the application

### Graph API permissions explained
The Graph API permission landscape consists of two parts from an automation perspective.  
In the basics, we have an app registration and a service principal. If not using automation only the app registration is needed. You log in interactively with the app registration and grant permissions on behalf of the user.   
If using automation you need a service principal. The service principal is created based on the app registration and has its own Graph API permissions called ```oauth2PermissionGrants```. This is the admin consent. 

The code below creates the app registration in the first place. The permissions are the Graph API resource permissions found in the [Microsoft Graph API permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference#all-permissions-and-ids). I used the application permissions.
```powershell
$appUrl = "https://graph.microsoft.com/beta/applications"
$appBody = @{
    "displayName"            = "EmergencyAccess"
    "signInAudience"         = "AzureADMyOrg"
    "requiredResourceAccess" = @(
        @{
            "resourceAppId"  = "00000003-0000-0000-c000-000000000000"
            "resourceAccess" = @(
                @{
                    "id"   = "9e3f62cf-ca93-4989-b6ce-bf83c28f9fe8" # RoleManagement.ReadWrite.Directory
                    "type" = "Role"
                },
                @{
                    "id"   = "df021288-bdef-4463-88db-98f22de89214" # Users.Read.All
                    "type" = "Role"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 5
$appRequest = Invoke-WebRequest -Method POST -Uri $appUrl -Headers $authHeader -Body $appBody
$appOutput = $appRequest.Content | ConvertFrom-Json
```
In the screenshot below, I created the app registration with the two permissions. As you can see it is missing the admin consent.
![app-permissions](app-permissions.png)

### Create service principal
Creating a service principal based on the app registration is quite easy using the command below.  
I just tell the Graph API to create a service principal based on the app registration created above. I use the ```$appOutput``` variable from the app registration to create the service principal.
```powershell
$spUrl = "https://graph.microsoft.com/beta/servicePrincipals"
$spRequest = Invoke-WebRequest -Method POST -Uri $spUrl -Headers $authHeader -Body (@{
        "appId" = $appOutput.appId
    } | ConvertTo-Json)
$spOutput = $spRequest.Content | ConvertFrom-Json
$spOutput
```

### Set the Graph API permissions and admin consent automated
In the next step, we need to grant the service principal the permissions. This is called admin consent.

The code below creates the admin consent. The ```$spOutput``` variable is the service principal created above. The ```$appOutput``` variable is the app registration created above.

While adding permissions, you tell the service principal which permissions it needs under which application. In the example below, I tell the service principal that it needs the permissions from the enterprise application ```00000003-0000-0000-c000-000000000000``` (Microsoft Graph). The permissions in the application are ```RoleManagement.ReadWrite.Directory``` and ```Users.Read.All```.  

In the step below, I first request the internal ID from the Graph API application (resourceId). 
```powershell
$graphSpUrl = "https://graph.microsoft.com/beta/servicePrincipals?`$filter=appId eq '00000003-0000-0000-c000-000000000000'"
$grapSpRequest = Invoke-WebRequest -Method GET -Uri $graphSpUrl -Headers $authHeader
$grapshspOutput = ($grapSpRequest.Content | ConvertFrom-Json).value
```

In the body below all pieces are put together. The ```clientId``` is the service principal ID. The ```resourceId``` is the internal ID of the Graph API application. The ```scope``` is holding the API permissions from the Graph API application. The ```startTime``` and ```expiryTime``` are ignored but required.

```powershell
$body = @{
    "clientId"    = $spOutput.id # EmergencyAccess Service Principal ID
    "resourceId"  = $grapshspOutput.id # Graph Service Principal ID
    "consentType" = "AllPrincipals"
    "scope"       = "RoleManagement.ReadWrite.Directory Users.Read.All"
    startTime     = Get-Date
    expiryTime    = Get-Date
} | ConvertTo-Json
$content = Invoke-WebRequest -Uri "https://graph.microsoft.com/beta/oauth2PermissionGrants" -Headers $authHeader -Method POST -Body $body
$content.Content | ConvertFrom-Json
```




https://learn.microsoft.com/en-us/graph/api/resources/oauth2permissiongrant?view=graph-rest-beta
## Conditional Access

https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-update?view=graph-rest-1.0&tabs=http


## Log in process
1. Log in with the service principal using the client certificate.
2. Get the user object ID of the user you want to add to the exclusion group.
3. Add the user to the exclusion group.
4. Log in with the user account as the emergency user.



{{< bye >}}