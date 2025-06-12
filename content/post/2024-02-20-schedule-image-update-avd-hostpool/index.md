---
title: 'Schedule image update Azure Virtual Desktop host pool'
date: '2024-02-20T01:28:14+02:00'
author: 'Sander Rozemuller'
draft: true
images:
- images/post/schedule-image-update-avd-hostpool/timer.png
categories:
    - Azure Virtual Desktop
tags:
  - Automation
  - Azure API
  - PowerShell
type: "regular"
---
When you want to update session hosts in a host pool with automated management, you use session host update. Session host update enables you to update the underlying virtual machine (VM) image, size, disk type, and other configuration properties. It does this by deleting or deallocating the existing virtual machine and creating a new one with the updated configuration stored in the session host configuration.
I'm realy exited abou this new feature. 
In this blog, I explain this new feature in how it works, where to think of when using it and, how to manage this (in an automated way).

{{< toc >}}

## Why use a (golden) image?
First, let’s talk about images. Because why should you use an image afterall. Well, I could be short in that, you don’t want trouble. Often I see AVD environments without the back of the Azure Compute Gallery or managed images. If I ask why not using images, I got answers like there are just a few hosts, it is a cost thing, or complex.

In fact, except for the cost thing, I can’t say people are not right. Yes if you have a few hosts it looks a bit overkill. And yes, if you are not that familiar with an automated image updating process (or updating manually(!)) it could be complex.  
But, regardless of the host count and process, you don’t want any problems in your production environment after the update. I understand, you always have to test. But (in place) updating hosts in a production environment isn’t just a good idea because host will become different during the time. And the fact you don’t have a roll-back option in the case hosts are really broken.

So when having an AVD or W365 environment, using an image is recommended. Luckily, there are several options for using images. The [Azure Compute Gallery](https://docs.microsoft.com/en-us/azure/virtual-machines/azure-compute-gallery) and [managed image](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/capture-image-resource) are the most common. 

So let’s say it one more time, use an image :).

In case you are not that familiar with image management, check this [document about setting up a golden image](https://docs.microsoft.com/en-us/azure/virtual-desktop/set-up-golden-image).

In addition to the golden image document above, I wrote a [blog about image management and how to automate](https://rozemuller.com/create-avd-image-version-based-on-existing-config-with-powershell/) it.

# Host pool image update
After you have an image available it would be nice to update hosts with the new image. Previously, updating session hosts was a pretty extensive process.  
First, we have to add the new session hosts (to make sure everybody can still use AVD). Secondly, we enable drain-mode into the old session hosts. At last, when the old hosts are empty, we delete the old session hosts. Besides AVD, we also have the Azure AD pollution because of old session hosts, object ID issues, and double costs because of a double amount of session hosts (to avoid downtime).

Till today, Microsoft announced the public preview of scheduled host pool image updates.

Host pool update is an IT administrator feature for `pooled` host pools. It enables the admin to update the current OS image of all the VMs in a pooled host pool to a new image (version).

Source: Microsoft

## Prerequisites
To make this feature work, keep in mind you have the following in place.

- Remove any resource locks on session hosts or the resource group they're in.
- Disable Autoscale if you're using it with the host pool you want to update. You can enable it after the update has completed.
- An existing pooled host pool with automated management with session hosts that are all in the same Azure region and resource group. 

- <u>Personal host pools aren't supported.</u>

### Key Vault
A key vault containing the secrets you want to use for your virtual machine local administrator account credentials and, if you're joining session hosts to an Active Directory domain, your domain join account credentials. You need a secret for a username and password.
Give the `Azure Virtual Desktop` service principal `Get secret permission` access to the secrets.

Also the Key Vault must allow Azure Resource Manager for template deployment.

![key-vault-permissions](key-vault-permissions.png)

### Permissions
During the update process, the Azure Virtual Desktop enterprise application is used. Make sure you have set the correct permissions.
To set the correct permissions, add the assign the `Desktop Virtualization Session Host Operator` and `Desktop Virtualization Virtual Machine Contributor` to the Azure Virtual Desktop service principal at the resource group where the session hosts at.
These permissions are needed to control the session host in the AVD host pool.

During the update process also the virtual machine is removed and rejoined to Entra ID. To control devices in Entra ID, add the `Cloud Device Administrator` role to Azure Virtual Desktop principle. This is the role that allows to remove devices from Entra ID. Assign the role using Priveleged Identity Management (PIM). 


When using the `Azure Compute Gallery`, the Azure Virtual Desktop principle also needs `Microsoft.Compute/galleries/images/versions/read` permissions over the gallery image version scope. Because there is no role having this specific scope, we need to create a custom role. 


#### Create custom role (using REST API)
Adding custom roles using the Azure portal can be done at management group, subscription or resource group level. In the host pool update scenario I add a custom role at resource group level where the Azure Compute Gallery at. 

Use the JSON body below to create a custom role called `AVD Hostpool Update Gallery Version Read` with the needed permissions.
```json
{
    "properties": {
        "roleName": "AVD Hostpool Update Gallery Version Read",
        "description": "",
        "assignableScopes": [
            "/subscriptions/{subscriptionId}/resourceGroups/{computeGalleryGroup}"
        ],
        "permissions": [
            {
                "actions": [
                    "Microsoft.Compute/galleries/images/versions/read"
                ],
                "notActions": [],
                "dataActions": [],
                "notDataActions": []
            }
        ]
    }
}
```

Provide the body to the endpoint below using a PUT request.
```basic
https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/{selfcreatedGuid}?api-version=2022-04-01
```

![create-customRole](create-customRole.png)

Thereafter, use the returned ID (in the red box) in the next request to assign the just-created role to the Azure Virtual Desktop principle at resource group level.

Send a PUT request to the endpoint below.
```basic
https://management.azure.com/{assignableScopeFromAbove}/providers/Microsoft.Authorization/roleAssignments/{selfCeatedGuidFromAbove}?api-version=2022-04-01
```

The JSON body looks like
```json
{
  "properties": {
    "roleDefinitionId": "/subscriptions/{subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/{selfCeatedGuidFromAbove}",
    "principalId": "2d6501e2-a283-4f99-800c-01822f91c1b6"
  }
}
```
Use PowerShell for example to create a GUID with the `New-Guid` command.

The principalId (arrow) is the ObjectId from the Azure Virtual Desktop application.
![avd-principal](avd-principal.png)

The Id at number 1 is the custom role's Id created at the first step.
The Url in the box is the endpoint including the assignable scope part used in the step above.

![assign-customRole](assign-customRole.png)

For more information adding custom roles using the Azure API, check [this Microsoft Learn page](https://learn.microsoft.com/en-us/azure/role-based-access-control/custom-roles-rest#create-a-custom-role)

# Hostpool Update process
The host pool image update proces consists of a host pool update configuration. When adding new session hosts, also the configuration is used.
When scheduling a host pool image update in the portal, you can select an image and change the session host configuration. In the case of a Compute Gallery, you can select the correct gallery definition. In the most common situations, the portal gives you all the options you need. 

Currently view and edit configuration is supported througth the portal. 
![avd-hostpool-update-configuration](avd-hostpool-update-configuration.png)

Good to know is when editing the configuration, you also have to schedule the update.
<u>To update the configuration only, you must use PowerShell or the REST API.</u>

I would suggest using the Az.Avd PowerShell module. 
To update the host pool configuration using Az.Avd use the commands below:

```powershell
Get-AvdHostPoolUpdateConfiguration -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName | Convertto-Json -Depth 99 | Out-File hostpoolconfig.json
```
The first command is to get the current host pool update configuration. The module gives all objects needed to update the configuration. 
![update-configuration](update-configuration.png)

Edit the JSON to your needs and provide the JSON content to the command below. In the command below, I stored the output into a JSON file, edited the configuration and saved the file. 

Use the next command to update the configuration.
```powershell
$jsonConfig = Get-Content hostpoolconfig.json
---
Update-AvdHostPoolUpdateConfiguration -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName -JsonContent $jsonConfig
```

After the configuration is changed you get a message in the browser. When viewing the configuration using the View button, you will notice nothing is changed. Till the moment you update the host pool, the 'old' settings will show up. When scheduling an update, you will get the new config. 

![avd-hostpool-update-configchange](avd-hostpool-update-configchange.png)

## How does it work?
I did a lot of testing, digging, and talking with Microsoft about what is going on in the background. In the upcoming paragraph, we look into the backend process and how all data is related. In the drawing below I show the process.

![hostpool-update](hostpoolupdate.png)

When starting the update process, you can specify the number of session hosts in a host pool to update concurrently. This is also called a update batch. This is the maximum number of session hosts that are unavailable at a time during the update. 
When an update starts, only one session host is targeted, known as the initial, to test that the end-to-end update process is successful before moving on to updating the rest of the session hosts in the pool in batches. This is to minimize the impact if a failure occurs.

For example, if you have a host pool with 10 session hosts and you enter a batch size of three, a single session host (the initial) is updated, then the remaining session hosts are updated in three batches of three session hosts. At any point after the initial session host has completed updating there are a minimum of seven session hosts available for use in the host pool.

## Start host pool update
Starting a host pool update using the portal is simple. Go to session host blade, click on `Manage Session Host Update` and click on `New Update`. From there follow the wizard.

![start-hostpool-update](start-hostpool-update.png)

Good to know is that a host pool update <u>only</u> starts when a session host does not fit the current configuration. If all session hosts fits the current configuration, the update will not start.

When the update starts, a session host will follow the process below:

- The hosts that are eligible for update are selected. A `notification message is sent` to the logged in users. In the same step also the `session host put into drain mode`. (When drain mode is on, new users are not able to login to that host)
- `Wait time starts counting`, this is the duration time before users are forced logged off.
- `Session hosts are removed from host pool`, if session hosts are Entra ID joined, a deregistration takes place. In the case of Active Directory join, the computer account is not deleted.
- `New session hosts are created` using the new configuration. The created Azure resources (VM, NIC and OS Disk) get a new name with a timestamp. The computer hostname is the same. Based on AD join type, the correct extension is installed.
- `Same number of session hosts are added to the host pool`, `drain mode is set to off`
- `Original resources are deallocated`. If you choose to remove the old resources, then the resources are deleted.

## Host pool image update in an automated way
To configure the host pool image update automated, I use [the Az.Avd PowerShell module](https://www.powershellgallery.com/packages/Az.Avd/).  
To install the Az.Avd PowerShell module, use the commands below.

```powershell
Install-Module -Name Az.Avd
Import-Module -Name Az.Avd
```

### Start AVD Host Pool Update Automated
When having a new host pool update configuration, it is time to start a host pool update.
Use the command below to start a host pool update.

```powershell
Start-AvdHostPoolUpdate -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName -MaxVMsRemovedDuringUpdate 1
```

### Get the update state
To check the last/current update results use the command below.

![update-status](update-status.png)

```powershell
Get-AvdHostPoolUpdateStatus -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName -MaxVMsRemovedDuringUpdate 1
```
For more detailed information, add the `-Raw` flag in the command.

![update-status-raw](update-status-raw.png)

At last, if you want also historical information, add the `-Records` in the command follows by the number of records.

### Stop, Cancel, Pause/Resume, Retry Host Pool Update
There could be a reason why you want to interupt a running update process. Use the commands below to interupt the host pool update process

```powershell
Stop-AvdHostPoolUpdate -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName # For stopping the current update process
Suspend-AvdHostPoolUpdate -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName # For pausing the current update process

Retry-AvdHostPoolUpdate -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName # For retrying the current update process
Restart-AvdHostPoolUpdate -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName # For retrying the current update process

Resume-AvdHostPoolUpdate -HostPoolName $hostpoolName -ResourceGroupName $ResourceGroupName # For resuming the current update process
```

{{< notice "warning" >}}
If you cancel an update part way through, there will be differences between the session hosts in the host pool, such as a different operating system version, or joined to a different Active Directory domain. This may provide an inconsistent experience to users, so you will need to schedule another update as soon as possible to make sure there is parity across all session hosts.
{{< /notice >}}

### Keep in mind

- To minimize downtime, the host pool image update operation is recommended should be planned during non-business hours/weekends
- If you have enabled Autoscale on your host pool, you will need to disable it for your host pool image update to be kicked off. It needs to stay off until the host pool image update is complete or else the update will fail with a run time error.
- Leave the session hosts at the host pool while the image update is ongoing. Doing so may create issues with the ongoing update.
- Leave the drain mode of any VMs in the host pool while an image update is ongoing. The update service automatically changes the drain mode of the VMs based on which stage of the update it is in. Note that if a session host is not recoverable after an update, its drain mode setting will be enabled. Once the update is complete, the drain mode is reset for the session hosts.
- There could be any number of host pool updates across the subscription or tenant happening concurrently. However, keep in mind that more than 1 update at a time will consume resources and may cause update failures. The best practice is to only have 1 running update at a time to prevent running out of Azure usage quota.
- The farthest date that the image update can be scheduled is 2 weeks from today’s date
- The existing power state and drain mode of session hosts is honored. This enables you to perform an update on a host pool where all the session hosts are deallocated to save costs.
- The approximate time taken for each session host to be updated to a new image is around 25 minutes. Depending on the specified batch size (customer admin specified # of session hosts to be updated concurrently), the time can roughly be calculated by:

Update time = (host pool size ÷ batch size) \* 25 minutes

This is not an exact end-to-end update time. The update process takes time to ensure that session hosts are back online in a healthy state before declaring the update successfully completed.

{{< notice "warning" >}}
When using Azure Virtual Desktop Insights, the Azure Monitor Agent is not installated automatically. You have to add the new session hosts into Log Analytics.
{{< /notice >}}

I hope you got a bit inspired.

Enjoy your day and happy automating 👋