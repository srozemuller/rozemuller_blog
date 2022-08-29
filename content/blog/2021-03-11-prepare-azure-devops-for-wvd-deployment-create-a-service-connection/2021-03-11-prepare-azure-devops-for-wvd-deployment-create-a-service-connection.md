---
id: 1175
title: 'Prepare Azure DevOps for WVD deployment – Create a Service Connection Automated'
date: '2021-03-11T11:28:00+01:00'
author: 'Sander Rozemuller'
layout: post
guid: 'https://rozemuller.com/?p=1175'
url: prepare-azure-devops-for-wvd-deployment-create-a-service-connection/
wp_last_modified_info:
    - '2 June 2021 @ 9:28 pm'
wplmi_shortcode:
    - '[lmt-post-modified-info]'
newszone_post_views_count:
    - '135'
ekit_post_views_count:
    - '136'
image: /wp-content/uploads/2021/03/slices.png
categories:
    - 'Azure Virtual Desktop'
    - DevOps
tags:
    - DevOps
    - Powershell
    - 'REST API'
---

Using Azure DevOps is a really nice way to deploy resources in Azure, so also for Windows Virtual Desktop. Before you are able to deploy resources into Azure with pipelines you will need to setup a project and a service connection first. In post I will explain how to create a DevOps Service Connection the automated way.

## Introduction

In this series about Prepare Azure DevOps for Windows Virtual Desktop deployment I will post a few small blogposts which will help you setting up a WVD prepared DevOps environment, fully automated. At the end of this series you will able to create a script which let you fill in an application name, a projectname and a PAT code for connecting to DevOps and will run all the needed steps to start with DevOps.

This series consists of the following subjects:

- [App registration in Azure Active Directory](https://rozemuller.com/prepare-azure-devops-for-windows-virtual-desktop-deployment-app-registration/)
- [Create an Azure DevOps project](https://rozemuller.com/prepare-azure-devops-for-windows-virtual-desktop-deployment-create-devops-project/)
- [Add a Service connection in the DevOps project](https://rozemuller.com/prepare-azure-devops-for-wvd-deployment-create-a-service-connection/)
- Create a pipeline from a source project
- Using environments for manual image action dynamically

At the start of this blog post you have created the following resources.

- An Azure AD Service principal, with deployment permissions
- A DevOps organisation with a project

## Table of contents

- [What is a service connection](#basics)
- [Manual configuration](#manual)
    - [Types](#types)
    - [Methods](#methods)
    - [Scopes](#scopes)
    - [Authentication](#authentication)
- [Automated configuration](#automated)
    - [REST API](#rest)
    - [Body](#body)
    - [Custom body](#custom)
    - [Body explained](#explained)
- [How to use](#howto)

Now it is time to create a DevOps service connection automated. Before creating a service connection it is good to know the basics.

## What is a service connection

Service connections enable you to connect to customer tenants to execute tasks in a job. For example, you may need to connect to your Microsoft Azure subscription, to a different build server or file server, to an online continuous integration environment, or to services you install on remote computers.

It’s possible to define service connections in Azure Pipelines that are available for use in all your tasks. For example, you can create a service connection for your Azure subscription and use this service connection name in an Azure Web Site Deployment task in a release pipeline.

In this case we are using the service connection for deploying WVD resources like a WVD hostpool, NSG, sessionhosts, etc.

More info about service connections please check: [https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&amp;tabs=yaml](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml)

## Manual configuration

Creating a service connection in the portal is very simple. Under Project Settings -&gt; Pipelines -&gt; Service connections you are able to create a new service connection.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/02/image-2.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### Types

Service connections consists of many different types, for example Azure Resource Manager, GitHub or Jenkins. When creating service connections you will need to know which resource type you want to connect to and which method you want to use. At last you need to choose on which scope you want to setup the connection.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/02/image-3.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>In this post we will use the Azure Resource Manager. The reason why using the Azure Resource Manager type seems pretty clear since we like to deploy resources to Azure.

### Methods

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/02/image-1.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### Scopes

Choosing the right scope depends on the situation. In this post I will handle two of them, subscription and management group.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/02/image-5.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>Choosing the right scope level depends on how the tenant permissions are configured. If you are using management groups with permissions set you should select that one, otherwise you should select subscription level. If you have many subscriptions in one tenant you should consider creating management groups.

More about management groups check: https://docs.microsoft.com/nl-nl/azure/governance/management-groups/overview

### Authentication

Under authentication you can fill in the just created service principal with the secret and tenant id. By clicking the verify button the connection will be tested.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/02/image-6.png)</figure>#### Management group

If you selected the management group type make sure that the service principal has at least reader access to the management group. Go to management groups in the portal, click the management group and then click detail. Then choose Access Control (IAM) and set the correct permissions.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/02/image-7.png)</figure>#### Subscription

If you like to connect to a subscription make sure your principal has the needed permissions on the subscription. Choose then the IAM settings at subscription level.

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>## Automated configuration

Although it is simple to create a service connection via the portal there are several reasons using an automated process for creating connections. Beside it is just fun exploring a new world it is very useful when you are able to prepare a complete DevOps environment with just one click. Let me explain how to create a DevOps service connection automated.

### REST API

For the automated configuration we are going to use the DevOps API’s again.  
As you can read in the [previous post](https://rozemuller.com/prepare-azure-devops-for-windows-virtual-desktop-deployment-create-devops-project/) I’m using the API at organisation level and will create a project. In this post we need to go into the project and create a service connection. As far as I know this is the only way to create a service connection automated.

In the script we will call the API two times to achieve this goal. The first call to get the projectID, because we needed in the API call body. The second time to create a service connection at project level.

### Body

With the manual configuration in mind we now know there are different Azure service connection methods, their different types and scopes. In this scenario we need to deploy Azure resources based on a service principal on a management group scope. The service principal was created at the [first part of this series](https://rozemuller.com/prepare-azure-devops-for-windows-virtual-desktop-deployment-app-registration/).

After some research I was able to map the portal values to the API body values.   
The way I used was creating a manual service connection first, after creation I did a GET API call and read the data. If you aren’t familiar with API the code below will help you finding the correct settings. This will also help with creating complete new connections with other types like GitHub. In that case I also will create a connection manual first to find out which parameters I need.

#### Send request

```powershell
$personalToken = "verysecretcode"
$organisation = "MyDevOpsOrganisation"
$ProjectName = "The DevOps project"
$URL = "https://dev.azure.com/$organisation/$ProjectName/_apis/serviceendpoint/endpoints?api-version=6.0-preview.4"
$AzureDevOpsAuthenicationHeader = @{Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($personalToken)")) }
$Parameters = @{
    Uri         = $URL
    Method      = "GET"
    Headers     = $AzureDevOpsAuthenicationHeader
    Erroraction = "Stop"
}
$Result =  Invoke-RestMethod @Parameters
$Result.value | ConvertTo-Json
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>Just fill in the correct parameters and send the request.

#### Response

```
<pre class="wp-block-code">```json
{
     "data": {
       <strong>"environment": "AzureCloud",</strong> <---
       <strong>"scopeLevel": "Subscription",</strong> <---
       "subscriptionId": "xxxx",
       "subscriptionName": "xxxx",
       "resourceGroupName": "",
       "mlWorkspaceName": "",
       "mlWorkspaceLocation": "",
       "managementGroupId": "",
       "managementGroupName": "",
       "oboAuthorization": "",
       "creationMode": "Automatic",
       "azureSpnRoleAssignmentId": "xxxx",
       "azureSpnPermissions": "[{\"roleAssignmentId\":\"xxxx\",\"resourceProvider\":\"Microsoft.RoleAssignment\",\"provisioned\":true}]",
       "spnObjectId": "xxxx",
       "appObjectId": "xxxx",
       "resourceId": ""
     },
     "id": "xxxx",
     "name": "WVDExpertToAccept",
     <strong>"type": "azurerm",</strong> <---
     "url": "https://management.azure.com/",
     "createdBy": {
       "displayName": "Sander Rozemuller",
       "url": "xxxx",
       "_links": "@{avatar=}",
       "id": "xxxx",
       "uniqueName": "srozemuller@xxxx",
       "imageUrl": "xxxx",
       "descriptor": "aad.NGMyNDEwYTUtY2Y4OS03YzYxLThlNDEtMmMwN2UyM2M4MWQx"
     },
     "description": "",
     "authorization": {
       "parameters": "@{tenantid=xxxx; serviceprincipalid=xxxx; authenticationType=spnKey; scope=/subscriptions/xxxx/resourcegroups/xxxx}",
       <strong><em>"scheme": "ServicePrincipal"</em></strong> <---
     },
     "isShared": false,
     "isReady": true,
     "operationStatus": {
       "state": "Ready",
       "statusMessage": ""
     },
     "owner": "Library",
     "serviceEndpointProjectReferences": [
       "@{projectReference=; name=WVDExpertToAccept; description=}"
     ]
   }
 ]
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>By doing some research on the response body you will learn a lot how to setup the correct request body. The most important and static values has been marked with &lt;—. These are the types, methods and scopes which are defined by Microsoft. The other parameters are user defined which I will show you in the next step.

### Creating custom body

A lot of information from the response body isn’t necessary for the script. The body below is needed to create a service connection.

As you can see this body is smaller then the response body. This is a snippet from the script which you can find on my [GitHub repository](https://github.com/srozemuller/Azure/tree/main/DevOps/Automation).

```powershell
$Body = @{
    data                             = @{
        managementGroupId   = $managementGroupId
        managementGroupName = $managementGroupName
        environment         = "AzureCloud"
        scopeLevel          = "ManagementGroup"
        creationMode        = "Manual"
    }
    name                             = $ConnectionName
    type                             = "AzureRM"
    url                              = "https://management.azure.com/"
    authorization                    = @{
        parameters = @{
            tenantid            = $TenantInfo.Tenant.Id
            serviceprincipalid  = $AADApplication.ApplicationId.Guid
            authenticationType  = "spnKey"
            serviceprincipalkey = $PlainPassword
        
        }
        scheme     = "ServicePrincipal"
    }
    isShared                         = $false
    isReady                          = $true
    serviceEndpointProjectReferences = @(
        @{
            projectReference = @{
                id   = $ProjectID
                name = $ProjectName
            }
            name             = $ConnectionName
        }
    )
}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>### Body explained

For the dynamic parts I’ve created parameters.   
Things like environment, scopeLevel, creationMode and type are always the same for me, at this time.   
For the leftovers I will explain what they are.

First the data part, this is the same as the [scope part](#scopes) in the manual configuration. In this scenario I’ve chosen to use the management group scope level. By choosing management groups you will need a management group name and ID.

If you need a service connection at subscription scope level change the scope level to “*Subscription*“. Of course the ManagementgroupId and ManagementgroupName part should be replaced for SubscriptionId and SubscriptionName.

```powershell
 data = @{
        managementGroupId   = $managementGroupId
        managementGroupName = $managementGroupName
        environment         = "AzureCloud"
        scopeLevel          = "ManagementGroup"
        creationMode        = "Manual"
    }
```

If you like to create a connection to a subscription instead of a management group then the script will use the parameters below.

```powershell
    data                             = @{
        SubscritptionId     = $SubscritptionId
        SubscriptionName    = $SubscriptionName
        environment         = "AzureCloud"
        scopeLevel          = "Subscription"
        creationMode        = "Manual"
    }
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>The next part is pretty clear like a name, url and [type](#types). The type is the first thing you choose when creating a manual connection.

```powershell
    name                             = $ConnectionName
    type                             = "AzureRM"
    url                              = "https://management.azure.com/"
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>The authentication step ([in manual](#authentication)) is the part where to fill in the tenantId, ApplicationId and secret. The scheme in this case is ServicePrincipal, the [method](#methods).

```powershell
    authorization                    = @{
        parameters = @{
            tenantid            = $TenantId
            serviceprincipalid  = $ApplicationId
            authenticationType  = "spnKey"
            serviceprincipalkey = $PlainPassword
        
        }
        scheme     = "ServicePrincipal"
    }
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>The last part is configuring the project reference. The place where to tell in which project the connection needs to be created. Because we like to automate things we seach for the projectId which can be found through an API call.

The URL you need is:  
https://dev.azure.com/$($organisation)/\_apis/projects?api-version=6.0<a href=""></a>

After querying the projects you will get a result like below.

```
<pre class="wp-block-code">```
id : xxx
name : Windows Virtual Desktop
url : https://dev.azure.com/xxx/_apis/projects/xxx
state : wellFormed
revision : 414
visibility : private
lastUpdateTime : 2/28/2020 2:47:03 PM
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>Now you know the Id and Name, you are able to fill in every needed parameters to create a DevOps service connection the automated way.

```powershell
serviceEndpointProjectReferences = @(
        @{
            projectReference = @{
                id   = $ProjectID
                name = $ProjectName
            }
            name             = $ConnectionName
        }
    )
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>## How to use

In my case the script is a part of a sequence so a lot of parameters are allready known by task. The script at my repository can be used as a standalone script which can be used the following way:

```powershell
.\<strong>create-DevOpsServiceConnection.ps1</strong> -personalToken xxx -organisation DevOpsOrganisation -ProjectName WVD -ManagementGroupId MGTGROUP1 -ManagementGroupName 'MGT GROUP 1' -TenantId xxx-xxx -ApplicationId xxx-xxx-xxx -ApplicationSecret 'verysecret'
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>More information about the service connection API please check: <https://docs.microsoft.com/en-us/rest/api/azure/devops/serviceendpoint/endpoints/create?view=azure-devops-rest-6.1#create-service-endpoint>

As I mentioned before in the blog I published some snippets. The complete script is stored at my [GitHub ](https://github.com/srozemuller/Azure/tree/main/DevOps/Automation)page.

Happy automating 😉 and thank you for reading.