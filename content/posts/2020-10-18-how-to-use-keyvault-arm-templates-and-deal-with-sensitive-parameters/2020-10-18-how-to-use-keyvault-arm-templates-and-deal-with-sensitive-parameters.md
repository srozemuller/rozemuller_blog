---
id: 615
title: 'How to use Key Vault ARM templates and deal with sensitive parameters'
date: '2020-10-18T18:19:13+02:00'
author: 'Sander Rozemuller'
layout: post
guid: 'https://rozemuller.com/?p=615'
permalink: /how-to-use-keyvault-arm-templates-and-deal-with-sensitive-parameters/
newszone_post_views_count:
    - '47'
ekit_post_views_count:
    - '48'
image: /wp-content/uploads/2020/10/arm-with-keyvault-300x250.png
categories:
    - Azure
    - Security
tags:
    - 'ARM templates'
    - KeyVault
    - Powershell
---

At October 14, 2020 Mircosoft [announced](https://docs.microsoft.com/en-us/azure/key-vault/keys/quick-create-template?tabs=CLI) the public preview of ARM templates for adding secrets to Azure Key Vault. In this article I will explain a way how to use these templates.

### Table of contents

1. [Key Vault overview](#overview)
2. [The templates](#thetemplates)
3. [The Key Vault parameter file](http://kvparameter)
4. [Adding Key Vault items](#kvitems)
5. [Splatting item parameters](#splatting)

  
  
The main reason why using ARM templates is the less of PowerShell modules you need. Using less modules will result in less PowerShell module updates and commands which will break. Beside that using templates will avoid editing scripts.

### Key Vault overview

The Azure Key Vault is a central location where you can securely store keys, secrets and certificates. Using the Key Vault will help you to store secret information outside of script or application. By configuring an access policy you are able to configure permissions for a user, group or service principal and to monitor access and use of Key Vault items.

<figure class="wp-block-image">![](https://tomkerkhoveblog.blob.core.windows.net/cloudy-adventures/securing-sensitive-data-with-azure-key-vault/Authentication-Cycle.png)</figure>### The templates

First I separated the Key Vault resource from the secret resource. This because the objectId parameter is mandatory. Based on the separate files I’ve created a paramater file for the Azure Key Vault resource with only the mandatory parameters.

```
<pre class="wp-block-code">```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "keyVaultName": {
      "type": "string",
      "metadata": {
        "description": "Specifies the name of the key vault."
      }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]",
      "metadata": {
        "description": "Specifies the Azure location where the key vault should be created."
      }
    },
    "enabledForDeployment": {
      "type": "bool",
      "defaultValue": false,
      "allowedValues": [
        true,
        false
      ],
      "metadata": {
        "description": "Specifies whether Azure Virtual Machines are permitted to retrieve certificates stored as secrets from the key vault."
      }
    },
    "enabledForDiskEncryption": {
      "type": "bool",
      "defaultValue": false,
      "allowedValues": [
        true,
        false
      ],
      "metadata": {
        "description": "Specifies whether Azure Disk Encryption is permitted to retrieve secrets from the vault and unwrap keys."
      }
    },
    "enabledForTemplateDeployment": {
      "type": "bool",
      "defaultValue": false,
      "allowedValues": [
        true,
        false
      ],
      "metadata": {
        "description": "Specifies whether Azure Resource Manager is permitted to retrieve secrets from the key vault."
      }
    },
    "tenantId": {
      "type": "string",
      "defaultValue": "[subscription().tenantId]",
      "metadata": {
        "description": "Specifies the Azure Active Directory tenant ID that should be used for authenticating requests to the key vault. Get it by using Get-AzSubscription cmdlet."
      }
    },
    "objectId": {
      "type": "string",
      "metadata": {
        "description": "Specifies the object ID of a user, service principal or security group in the Azure Active Directory tenant for the vault. The object ID must be unique for the list of access policies. Get it by using Get-AzADUser or Get-AzADServicePrincipal cmdlets."
      }
    },
    "keysPermissions": {
      "type": "array",
      "defaultValue": [
        "list"
      ],
      "metadata": {
        "description": "Specifies the permissions to keys in the vault. Valid values are: all, encrypt, decrypt, wrapKey, unwrapKey, sign, verify, get, list, create, update, import, delete, backup, restore, recover, and purge."
      }
    },
    "secretsPermissions": {
      "type": "array",
      "defaultValue": [
        "list"
      ],
      "metadata": {
        "description": "Specifies the permissions to secrets in the vault. Valid values are: all, get, list, set, delete, backup, restore, recover, and purge."
      }
    },
    "skuName": {
      "type": "string",
      "defaultValue": "Standard",
      "allowedValues": [
        "Standard",
        "Premium"
      ],
      "metadata": {
        "description": "Specifies whether the key vault is a standard vault or a premium vault."
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.KeyVault/vaults",
      "apiVersion": "2019-09-01",
      "name": "[parameters('keyVaultName')]",
      "location": "[parameters('location')]",
      "properties": {
        "enabledForDeployment": "[parameters('enabledForDeployment')]",
        "enabledForDiskEncryption": "[parameters('enabledForDiskEncryption')]",
        "enabledForTemplateDeployment": "[parameters('enabledForTemplateDeployment')]",
        "tenantId": "[parameters('tenantId')]",
        "accessPolicies": [
          {
            "objectId": "[parameters('objectId')]",
            "tenantId": "[parameters('tenantId')]",
            "permissions": {
              "keys": "[parameters('keysPermissions')]",
              "secrets": "[parameters('secretsPermissions')]"
            }
          }
        ],
        "sku": {
          "name": "[parameters('skuName')]",
          "family": "A"
        },
        "networkAcls": {
          "defaultAction": "Allow",
          "bypass": "AzureServices"
        }
      }
    }
  ]
}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### The KeyVault parameter file

The parameter file has the Key Vault name, permissions and objectId only. The objectId is an Azure AD object like a user, group or service principal. This id will get permission to the Key Vault.

```
<pre class="wp-block-code">```json
{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "keyVaultName": {
            "value": "tst-kv-tst1"
        },
        "objectId": {
            "value": "d1a2aa35-4e4b-4b94-a9f0-137027085535"
        },
        "keysPermissions": {
            "value": [
                "list",
                "read"
            ]
        },
        "secretsPermissions": {
            "value": [
                "list",
                "read"
            ]
        }
    }
}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>##### PowerShell command

```powershell
New-AzResourceGroupDeployment -TemplateFile ./azuredeploy.json -TemplateParameterFile ./azuredeploy.parameters.json -ResourceGroupName groupname
```

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2020/10/Schermafbeelding-2020-10-18-om-18.28.17.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### Adding Key Vault items

After the Key Vault has been created you can fill it with items with an ARM template. I separated the resources otherwise you will be asked for an objectId every time.

```powershell
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "keyVaultName": {
      "type": "string",
      "metadata": {
        "description": "Specifies the name of the key vault."
      }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]",
      "metadata": {
        "description": "Specifies the Azure location where the key vault should be created."
      }
    },
    "secretName": {
      "type": "string",
      "metadata": {
        "description": "Specifies the name of the secret that you want to create."
      }
    },
    "secretValue": {
      "type": "securestring",
      "metadata": {
        "description": "Specifies the value of the secret that you want to create."
      }
    }
  },
  "resources": [
      {
      "type": "Microsoft.KeyVault/vaults/secrets",
      "apiVersion": "2019-09-01",
      "name": "[concat(parameters('keyVaultName'), '/', parameters('secretName'))]",
      "location": "[parameters('location')]",
      "dependsOn": [      
      ],
      "properties": {
        "value": "[parameters('secretValue')]"
      }
    }
  ]
}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### Splatting item parameters

For security reasons I recommend using parameter objects instead of parameter files. Parameter files contains plain text and often stored at a not save location. The technique which can be used is called [splatting](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_splatting?view=powershell-7#:~:text=Splatting%20is%20a%20method%20of,collection%20with%20a%20command%20parameter.).  
A parameter object is a PowerShell hashtable which can be inserted as object.

```powershell
$templateParameters = @{
    keyVaultName = "keyvault-name"
    secretName = "test-secret-4"
    secretValue = "test-secret-4-value"
}
New-AzResourceGroupDeployment -TemplateFile ./azuredeploy.json -TemplateParameterObject $templateParameters -ResourceGroupName resoursegroup
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>The files can be found at my [GitHub](https://github.com/srozemuller/Azure/tree/main/Azure%20Keyvault) repository