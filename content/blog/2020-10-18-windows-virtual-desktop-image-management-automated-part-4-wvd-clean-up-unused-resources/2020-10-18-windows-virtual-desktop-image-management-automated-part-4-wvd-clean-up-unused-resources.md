---
id: 625
title: 'Windows Virtual Desktop Image Management Automated – Part 4 &#8211; WVD Clean up unused resources'
date: '2020-10-18T20:08:27+02:00'
author: 'Sander Rozemuller'
layout: post
guid: 'https://rozemuller.com/?p=625'
url: windows-virtual-desktop-image-management-automated-part-4-wvd-clean-up-unused-resources/
newszone_post_views_count:
    - '57'
ekit_post_views_count:
    - '58'
digiqole_featured_post:
    - 'no'
wp_last_modified_info:
    - '19 July 2022 @ 8:21 pm'
wplmi_shortcode:
    - '[lmt-post-modified-info]'
image: /wp-content/uploads/2020/10/compute-single-vm1.png
categories:
    - 'Azure Virtual Desktop'
    - 'Image Management'
tags:
    - Azure
    - 'Cost Management'
    - 'Microsoft M365'
    - Powershell
---

The current situation, we have created new disks, snapshots, virtual machines, networks, images and session hosts. All the resources has been added to the existing WVD hostpool. Now it is time to cleanup the old resources, to keep everything nice and clean. In this part we will take care of removing components related to the old image version.

This post is a part of the series Windows Virtual Desktop Image Management Automated.

1. [Create WVD image version based on existing config with PowerShell – Part 1](https://rozemuller.com/create-wvd-image-version-based-on-existing-config-with-powershell/)
2. [Save WVD image with Sysprep as Image Gallery version – Part 2](https://rozemuller.com/save-wvd-image-with-sysprep-as-image-gallery-version/)
3. [Create WVD Sessionhosts based on Shared Image Gallery version – Part 3](https://rozemuller.com/windows-virtual-desktop-image-management-automated-part-3-create-wvd-sessionhosts-based-on-shared-image-gallery-version-with-arm/)
4. [WVD housekeeping, removing all unused sessionhosts, disks and images – Part 4 ](https://rozemuller.com/windows-virtual-desktop-image-management-automated-part-4-wvd-clean-up-unused-resources/)
5. [Monitor Image Versions with Azure Monitor – Part 5](https://rozemuller.com/windows-virtual-desktop-image-management-automated-part-5-monitor-image-versions-with-azure-monitor/)
6. Enroll MSIX packages automated – Part 6 – (coming soon)

### Table of content

1. [Tags, tags, tags](#tags)
2. [Get the resources](#resources)
3. [Cleanup](http://cleanup)
4. [What if you don’t use tags](#notags)

### Tags, tags, tags

After deploying the entire environment you have created a new disk, a snapshot, Azure virtual machines, network interfaces, an image and session hosts. This a quite a lot of resources and you will need to do a good job keeping all these resources up-to-date. Well, there is a better housekeeping solution.   
I work a lot with tags. By tagging resources consequent you can find the relationship between resources by just one single click on a tag.

Let’s say you have the Azure VM resources with the ImageVersion. By clicking the tag you will get every resources which is in relation with that specific ImageVersion.

<figure class="wp-block-image size-large">![virtual machine](https://rozemuller.com/wp-content/uploads/2020/10/image-6-1024x178.png)</figure>By clicking the tag you will see the related disks, virtual machines, network interfaces and other resources with this tag value.

<figure class="wp-block-image size-large">![virtualmachine-resources](https://rozemuller.com/wp-content/uploads/2020/10/image-7.png)</figure>Now we know how to get all the related resources based on a tag lets fill the automation part.

### Get the resources

In the Azure portal you can click the tag you need and do your job (per tag). Because PowerShell doesn’t know the latest version, we need to find the latest images version used in the WVD hostpool.

##### WVD Hostpool

By knowing the WVD hostpool every other component can be find due some reverse engineering.

```powershell
param(
    [parameter(mandatory = $true, ValueFromPipelineByPropertyName)]$hostpoolName,
    [parameter(mandatory = $true, ValueFromPipelineByPropertyName)]$deleteResources
)

import-module az.desktopvirtualization
import-module az.network
import-module az.compute


# Getting the hostpool first
$hostpool = Get-AzWvdHostPool | ? { $_.Name -eq $hostpoolname } 
if ($null -eq $hostpool){
    "Hostpool $hostpoolname not found"
    exit;
}
# Creating VM configuration based on existing VM's in specific hostpool, selecting first one
$hostpoolRg = ($hostpool).id.split("/")[4]
Write-Output "Hostpool resourcegroup is $hostpoolRg"
```

##### Shared Image Gallery

To get the Shared Image Gallery information we need to know the sessionhost first. Sessionhost (actually an Azure VM) information contains storage information where the image information is stored.

```powershell
# Get one of the current production VM's for getting the share image gallery info
$sessionHosts = Get-AzWvdSessionHost -ResourceGroupName $hostpoolRg -HostPoolName $hostpool.name
$existingSessionHost = ($sessionHosts.Name.Split("/")[-1]).Split(".")[0]
$productionVm = Get-AzVM -Name $existingSessionHost
```

<figure class="wp-block-image size-large is-resized">![version](https://rozemuller.com/wp-content/uploads/2020/10/image-8-1024x106.png)</figure>The next part will use the Azure VM information to get the Shared Image Gallery information and will search for the oldest version. By sorting on published date and grabbing the first result you will get the oldest version.

```powershell

# Source: https://docs.microsoft.com/en-us/azure/virtual-machines/image-version-managed-image-powershell
# Creating image version based on the image created few steps ago
$imageReference = ((get-azvm -Name $productionVm[-1].name -ResourceGroupName $productionVm[-1].ResourceGroupName).storageprofile.ImageReference).id
$galleryImageDefintion = get-AzGalleryImageDefinition -ResourceId $imageReference
$galleryName = $imageReference.Split("/")[-3]
$gallery = Get-AzGallery -Name $galleryName
$versions = Get-AzGalleryImageVersion -ResourceGroupName $gallery.ResourceGroupName -GalleryName $gallery.Name -GalleryImageDefinitionName $galleryImageDefintion.Name
$oldestVersion = $($versions | Sort-Object PublishedDate).name[0]
"Found version $oldestVersion"
```

### Cleanup

Knowing the oldest version we can search for any resource with the ImageVersion Tag where the value has the oldest version in it.   
If the parameter $deleteResources is $true the resources will be deleted. Else the WhatIf will be used.

```powershell
$tag = @{ImageVersion = $oldestVersion}
foreach ($resource in (Get-AzResource -Tag $tag)) {
    $resource
    if ($deleteResources) {
        Remove-AzResource -ResourceId $resource.ResourceId -Force
    }
    else{
        Remove-AzResource -ResourceId $resource.ResourceId -WhatIf
    }
}
```

### What if you don’t use tags

Every resource related to tag ImageVersion has been deleted. I can imagine you don’t use tags at this moment. Don’t worry, there is a way to remove resources without the use of tags. In the foreach loop the script searches for a specific tag. If you don’t use tags this way searching for them is quite difficult :), so we need to find an another way.  
There is a way by searching Azure virtual machines on a specific storage profile. The ImageReference object contains an image version which can be used. By filtering that object you will get virtual machine only. By using the objects in the virtual machine you can find

```powershell
foreach ($resource in (get-azvm | ? {$_.storageprofile.ImageReference.ExactVersion -eq $oldestVersion})) {
    $resource
    if ($deleteResources) {
        Remove-AzResource -ResourceId $resource.ResourceId -Force
    }
    else{
        Remove-AzResource -ResourceId $resource.ResourceId -WhatIf
    }
}
```

Good luck and take care. This script will **<span class="has-inline-color has-vivid-red-color"><span style="text-decoration: underline;">DELETE</span> </span>**resources, i’m not responsible for any accidentally delete.