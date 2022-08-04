---
id: 969
title: 'Automatically backup Azure resources to an Azure Storage Account in JSON'
date: '2020-12-21T08:04:04+01:00'
author: 'Sander Rozemuller'
layout: post
guid: 'https://rozemuller.com/?p=969'
permalink: /automatically-backup-azure-resources-to-an-azure-storage-account-in-json/
newszone_post_views_count:
    - '62'
ekit_post_views_count:
    - '63'
digiqole_featured_post:
    - 'no'
wp_last_modified_info:
    - '20 July 2022 @ 7:55 am'
wplmi_shortcode:
    - '[lmt-post-modified-info]'
image: /wp-content/uploads/2020/12/image-16.png
categories:
    - Automation
    - Azure
    - Powershell
tags:
    - 'ARM templates'
    - 'Azure Storage'
    - Backup
    - JSON
---

In this quick blog post I will explain a way how to backup Azure resources and how to restore them with PowerShell, in JSON format, to an Azure Storage Account which is “deployment ready”.

### Main idea

The main idea is to export the resource configuration into a JSON file, with the parameters included. In case of emergency or when you like to setup the same resource to an another resourcegroup or subscription the JSON file can be download and deployed.

### Backup Azure Resources

Before creating backups we need a backup location. Of course the file can be stored at every place you like. I’m using an Azure Storage Account. Because I like to have my backups all at the same place I will put all the resources into the same Storage Account. I recommend using low costs storage with Cool access tier and Standard performance. (in this example it is Hot)

In this case I am using a Network Security Group (NSG) for example. First I will check if there is already a container for this resource type, if not it will be created.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2020/12/image-13-1024x190.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>The next step is creating a JSON output for each NSG. The -IncludeParameterDefaultValue switch in the Export-AzResourceGroup PowerShell command will take care of the resource specific parameters. Without this switch only an empty ARM template will be returned. So you better be use it :).

The export automatically download the file into the current folder where the script is at. Next I will create a blobname (filename at the storage account). The last step is to upload the file to the storage account. This can be achieved by executing the Set-AzStorageBlobContent command.

```powershell
$Resources = Get-AzNetworkSecurityGroup
if ($Resources) {
    $StorageAccount = get-AzStorageAccount | ? { $_.StorageAccountName -eq "satestsrbackup" }
    $ContainerName = ($Resources.Id).Split("/")[-2].ToLower()
    $StorageAccountContainer = $StorageAccount | Get-AzStorageContainer | Where { $_.Name -match $ContainerName }
    if ($null -eq $StorageAccountContainer){
        $StorageAccount | New-AzStorageContainer $ContainerName.ToLower()
    }
    foreach ($Resource in $Resources) {
        
        $BlobName = $($Resource).Name + ".json"
        $Export = $Resource | Export-AzResourceGroup -IncludeParameterDefaultValue -Force
        Set-AzStorageBlobContent -File $Export.Path -Container $ContainerName -Blob $BlobName  -Context $StorageAccount.context -Force
    }
}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2020/12/image-14-1024x112.png)</figure><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2020/12/image-15-1024x150.png)</figure><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2020/12/image-16-1024x730.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### Restore

When a restore is needed just download the file from the storage account and use it as input for the New-AzResourceGroupDeployment command.

```powershell
New-AzResourceGroupDeployment -TemplateParameterFile [file]
```

Now you are able to backup Azure resources and to restore them fully automatically.   
For more information about how backup