---
id: 655
title: 'Windows Virtual Desktop Image Management Automated – Part 5 &#8211; Monitor Image versions with Azure Monitor'
date: '2020-10-28T13:05:59+01:00'
author: 'Sander Rozemuller'
layout: post
guid: 'https://rozemuller.com/?p=655'
url: windows-virtual-desktop-image-management-automated-part-5-monitor-image-versions-with-azure-monitor/
newszone_post_views_count:
    - '31'
ekit_post_views_count:
    - '32'
digiqole_featured_post:
    - 'no'
wp_last_modified_info:
    - '19 July 2022 @ 8:21 pm'
wplmi_shortcode:
    - '[lmt-post-modified-info]'
image: /wp-content/uploads/2020/10/azure-monitor.png
categories:
    - Azure
    - 'Azure Virtual Desktop'
    - 'Image Management'
    - Monitoring
tags:
    - 'Kusto query'
    - Monitoring
    - 'Resource Graph'
    - Workbooks
---

When using the Windows Virtual Desktop for a longer time and created images several times you will noticed you are not able to remove old images directly when a new version has been deployed. Or in case of a MSP when you need to manage more then one image after some time you will lose sight on images and versions. An image overview would be nice to have. In this article I will show how to do some image version control on a WVD environment.

In this part I will describe some options how to create an image overview with Azure Monitor creating a Workbook based on Kusto Query. Main goal is to do some image version control on a WVD environment.

This post is a part of the series Windows Virtual Desktop Image Management Automated.

1. [Create WVD image version based on existing config with PowerShell – Part 1](https://rozemuller.com/create-wvd-image-version-based-on-existing-config-with-powershell/)
2. [Save WVD image with Sysprep as Image Gallery version – Part 2](https://rozemuller.com/save-wvd-image-with-sysprep-as-image-gallery-version/)
3. [Create WVD Sessionhosts based on Shared Image Gallery version – Part 3](https://rozemuller.com/windows-virtual-desktop-image-management-automated-part-3-create-wvd-sessionhosts-based-on-shared-image-gallery-version-with-arm/)
4. [WVD housekeeping, removing all unused sessionhosts, disks and images – Part 4 ](https://rozemuller.com/windows-virtual-desktop-image-management-automated-part-4-wvd-clean-up-unused-resources/)
5. [Monitor Image Versions with Azure Monitor – Part 5](https://rozemuller.com/windows-virtual-desktop-image-management-automated-part-5-monitor-image-versions-with-azure-monitor/)

### Table of content

1. [Create dashboard parameters](#parameters)
2. [Latest version per image](#imageoverview)
3. [Session host image version overview](#sessionhost)
4. [Final Kusto query](#final-kusto)

### Create dashboard parameters

First we need some dashboard parameters like subscription and image name. With parameters the report will find the information out of Azure Resource Graph.   
Although creating a complete workbook from scratch is not a part of the scope in this article, I will describe the basics from where to start.  
  
Go to Azure Monitor, click Workbook and click an Empty workbook

<figure class="wp-block-image size-large">![empty-workbook](https://rozemuller.com/wp-content/uploads/2020/10/image-28.png)</figure>In the workbook click Add and choose Add Parameters

<figure class="wp-block-image size-large is-resized">![add-parameters](https://rozemuller.com/wp-content/uploads/2020/10/image-27.png)</figure>From there you will be able to create dynamic parameters by executing queries. For example when requesting all subscriptions you will need to execute an Azure Resource Graph query.

<figure class="wp-block-image size-full is-resized">![edit-parameters](https://rozemuller.com/wp-content/uploads/2020/10/image-29.png)</figure>```
<pre class="wp-block-code">```basic
summarize Count = count() by subscriptionId
| project value = strcat('/subscriptions/', subscriptionId), label = subscriptionId, Selected = Count >= 0
```

<figure class="wp-block-image size-full is-resized">![subscription-parameter](https://rozemuller.com/wp-content/uploads/2020/10/image-30.png)</figure>The parameters you need are Subscription, SubscritptionId and ImageName.  
I’ve used the following queries to achieve that goal.

```
<pre class="wp-block-code">```basic
resourcecontainers
 | where type =~ "microsoft.resources/subscriptions"
 | summarize Count = count() by subscriptionId
 | project Label = subscriptionId, Id = subscriptionId, Selected = Count >= 0
```

And for the image name parameter

```
<pre class="wp-block-code">```basic
resources 
| where type =~ "microsoft.compute/virtualmachines"
 and isnotnull(properties.storageProfile.imageReference.exactVersion)
| mvexpand imageVersion = properties.storageProfile.imageReference.exactVersion
| extend imageInfo = split(properties.storageProfile.imageReference.id,"/")
| summarize Count=count() by Image=tostring(imageInfo[10])
| project Label =Image
```

  
At the end it will properly looks like this

<figure class="wp-block-image size-full is-resized">![azure-monitor-parameters](https://rozemuller.com/wp-content/uploads/2020/10/image-31.png)</figure>## Latest image version per image 

After creating parameters you can add modules by clicking the Add button (in the Workbook) and click Add Query.  
In the first place I want to know which is the last image version per image. This will result in the following overview.

<figure class="wp-block-image size-full is-resized">![image-gallery-overview](https://rozemuller.com/wp-content/uploads/2020/10/image-32.png)</figure>For creating this image overview i’ve used the following Azure Resource Graph Kusto query.

```
<pre class="wp-block-code">```basic
resources | where type contains "microsoft.compute/galleries/images/versions" 
| extend GalleryInfo = split(id,"/")
| project GalleryName=GalleryInfo[8], ImageName=GalleryInfo[10], ImageVersion=GalleryInfo[12], GalleryInfo[2]
| summarize LastVersion=max(tostring(ImageVersion)) by tostring(GalleryName), tostring(ImageName)
```

## Session host image version overview

The second overview will show the Azure Virtual Machines which are not on the latest version. It responds on the selected Image parameter.

The needed information is scattered over more resource types, to get the information together we need to join all the resources together. At first we query for Azure virtual machines which has an image version and extending the imageId and the exact version the virtual machine is using. Before creating a join we need to project the information first. This information will be used by the join statement.

```
<pre class="wp-block-code">```basic
resources 
| where type =~ "microsoft.compute/virtualmachines" and isnotempty(properties.storageProfile.imageReference.exactVersion)
| extend currentImageVersion = properties.storageProfile.imageReference.exactVersion
| extend imageName=split(properties.storageProfile.imageReference.id,"/")[10]
| project tostring(imageName), tostring(currentImageVersion), vmId=id 

```

The the most tricky and fun part is to join other resource types. This query is quite complex because of multiple joins.  
The main join will get the versions per image. The second join will check if the result is the last version and will put the result in a new column. This has been achieved by the summarize. If it is the latest version the result is yes, otherwise no 🙂  
I only return the latest version to avoid getting the no-results as well even when an Azure Virutual Machine is on the latest version.

```
<pre class="wp-block-code">```basic
| join kind=inner(
resources
| where type=~'microsoft.compute/galleries/images/versions'
| extend  imageName=split(id,"/")[10]
| project id, name, tostring(imageName)
| join kind=inner ( 
resources 
| where type =~ 'microsoft.compute/galleries/images/versions' 
| extend versionDetails=split(id,"/")
| project id, name, imageName=versionDetails[10], imageGallery=versionDetails[8], resourceGroup, subscriptionId
| summarize LastVersion=max(tostring(name)) by tostring(imageName) , tostring(imageGallery), resourceGroup, subscriptionId
) on imageName
| extend latestVersion = case(name != LastVersion, "No", "Yes")
| where latestVersion == "Yes"
) on imageName

```

Now we know the image version status the last part is matching the current Azure virtual machine version with the latest version.

```
<pre class="wp-block-code">```basic
| extend vmLatestVersion = case(currentImageVersion != LastVersion, "No", "Yes")
| extend vmDetails = split(vmId,"/")
| project vmLatestVersion,imageName, currentImageVersion, vmId, imageGallery, resourceGroup, subscriptionId, LastVersion

```

This query will return the complete list with Azure Virtual Machines with latest versions yes and no. If you like to seperate the results you can add a where statement which shows the status you want. This could be usefull when counting rows by state.

```
<pre class="wp-block-code">```basic
| where vmLatestVersion =~ "No"
```

<figure class="wp-block-image size-full is-resized">![sessionhost-good-image](https://rozemuller.com/wp-content/uploads/2020/10/image-33.png)</figure><figure class="wp-block-image size-full is-resized">![sessionhost-old-image](https://rozemuller.com/wp-content/uploads/2020/10/image-34.png)</figure>### Final Kusto query

The final Kusto query for Azure Resource Graph will result in the following

```
<pre class="wp-block-code">```basic
resources 
| where type =~ "microsoft.compute/virtualmachines" and isnotempty(properties.storageProfile.imageReference.exactVersion)
| extend currentImageVersion = properties.storageProfile.imageReference.exactVersion
| extend imageName=split(properties.storageProfile.imageReference.id,"/")[10]
| project tostring(imageName), tostring(currentImageVersion), vmId=id 
| join kind=inner(
resources
| where type=~'microsoft.compute/galleries/images/versions'
| extend  imageName=split(id,"/")[10]
| project id, name, tostring(imageName)
| join kind=inner ( 
resources 
| where type =~ 'microsoft.compute/galleries/images/versions' 
| extend versionDetails=split(id,"/")
| project id, name, imageName=versionDetails[10], imageGallery=versionDetails[8], resourceGroup, subscriptionId
| summarize LastVersion=max(tostring(name)) by tostring(imageName) , tostring(imageGallery), resourceGroup, subscriptionId
) on imageName
| extend latestVersion = case(name != LastVersion, "No", "Yes")
| where latestVersion == "Yes"
) on imageName
| extend vmLatestVersion = case(currentImageVersion != LastVersion, "No", "Yes")
| extend vmDetails = split(vmId,"/")
| project vmLatestVersion,imageName, currentImageVersion, vmId, imageGallery, resourceGroup, subscriptionId, LastVersion
```

Thank you for reading this post about how to do some image version control for a WVD environment.