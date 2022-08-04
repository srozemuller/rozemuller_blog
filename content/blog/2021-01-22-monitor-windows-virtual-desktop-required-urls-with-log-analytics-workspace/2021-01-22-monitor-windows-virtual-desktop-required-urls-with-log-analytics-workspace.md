---
id: 1053
title: 'Monitor Windows Virtual Desktop required URL&#8217;s with Log Analytics Workspace'
date: '2021-01-22T10:42:08+01:00'
author: 'Sander Rozemuller'
layout: post
guid: 'https://rozemuller.com/?p=1053'
url: monitor-windows-virtual-desktop-required-urls-with-log-analytics-workspace/
newszone_post_views_count:
    - '27'
ekit_post_views_count:
    - '28'
image: /wp-content/uploads/2021/01/monitoring-required-urls-1.png
categories:
    - Azure
    - 'Azure Virtual Desktop'
    - Monitoring
tags:
    - AVD
    - 'Log Analytics'
    - 'Network Security Groups'
    - Powershell
---

Microsoft has provided a list with URL’s which you need for running a Windows Virtual Desktop environment. In this blog post I will explain how to monitor any issues related to the WVD required URL’s. and how to setup the monitoring environment.

## Introduction

Most of the time you are able to connect to the Internet over port 443. But there could be several reasons you don’t. In case of a Windows Virtual Desktop environment it is critical you can reach Microsoft, otherwise you are unsupported. So it is very important to monitor WVD required URL’s. To help configuring the firewall Microsoft came up with an URL list.   
In this case I blocked every traffic to the Internet, with an exception to the Windows Virtual Desktop needed URL’s.

<figure class="wp-block-image size-full is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>## Table of Contents

- [Windows Event log](#eventlog)
- [Log Analytics](#loganalytics)
- [Monitor workbook](#workbook)
- [Alerting](#alerting)
- [Prevent issues](#prevent)

There are several ways to notice there is something wrong connecting to one of the required URL’s. In the next chapters I will handle some of them.

<div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>## Windows Event log

The most common and important place is the Windows event log on the sessionhosts. If there is an issue you will see events like below. A lot of application errors with source WVD-Agent and eventId 3019.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-1-1024x120.png)</figure><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-2.png)</figure>For every URL which cannot be reached there will be an event.  
There also could be some warnings on eventId 3702. You will see errors like this:

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/01/image-17.png)</figure>### Azure portal

An another place where to find issues is on the Azure Portal itself under the Windows Virtual Desktop blade.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-18-1024x176.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>## Log Analytics

A second place where you can find events is the Log Analytics Workspace. Important thing to know is that Log Analytics is not working out of the box. For using Log Analytics is you will need a Log Analytics workspace. Also make sure you installed the MicrosoftMonitoringAgent extension on each WVD session host.

I wrote a blog post about enabling [Azure Monitor for Windows Virtual Desktop](https://rozemuller.com/deploy-azure-monitor-for-windows-virtual-desktop-automated/). In that post I explain how to enable the Azure Monitor in basics for WVD including setting up a Log Analytics workspace with the correct settings.   
The blog post below will continue at the last section when adding session host to the workspace.

### **Add session hosts to Log Analytics Workspace**

If you have configured the Azure Monitor you will need to add every sessionhost to Log Analytics. Make sure you add this step into your WVD deployment sequence for future installations.

### Finding the Log Analytics Workspace

There are more way to figure out the Log Analytics Workspace. The first route is through the Azure portal by going to the Windows Virtual Desktop blade, select the correct hostpool and search for diagnostic settings.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/01/image-4-1024x471.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:25px"></div>A second way is by PowerShell using the command below. Use the provided workspace name.

```powershell
$HostpoolName = "Test-WVD-Host"
$ResourceGroup = "Test-WVD-ResourceGroup"
$hostpool = Get-AzWvdHostPool -name $HostpoolName -ResourceGroupName $ResourceGroup 
Get-AzDiagnosticSetting -ResourceId $hostpool.id | Select Name, @{Label=”WorkSpace Name”;Expression={($_.WorkspaceId.Split("/")[-1])}}
```

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-11-1024x91.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>If you have all the needed information use the PowerShell below for installing the OMSExtension.

```powershell
$HostpoolName = "Test-WVD-Host"
$ResourceGroup = "Test-WVD-ResourceGroup"
$Workspace = "LA-Workspace-xxxxx"

# region install Log Analytics Agent on Virutal Machine 
$ResourceGroup = ($hostpool).id.split("/")[4]
$sessionhosts = Get-AzWvdSessionHost -HostpoolName  $HostpoolName -ResourceGroupName $ResourceGroup
$virtualMachines = @($sessionhosts.ResourceId.Split("/")[-1])
$workspaceKey = ($Workspace | Get-AzOperationalInsightsWorkspaceSharedKey).PrimarySharedKey
$TemplateParameters = @{
    workspaceId = $Workspace.CustomerId
    workspaceKey = $workspaceKey
    virtualMachines = $virtualMachines
    extensionNames = @("OMSExtenstion")
}
New-AzResourceGroupDeployment -ResourceGroupName $ResourceGroup -TemplateUri "https://raw.githubusercontent.com/srozemuller/Windows-Virtual-Desktop/master/Azure-Monitor/deploy-lawsagent.json" -TemplateParameterObject $TemplateParameters
#endregion
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>At the end, if you have installed the Log Analytics extension on the sessionhosts, the Windows events will appear in the Log Analytics Workspace. I used the Kusto Query below for searching for WVD-Agent events.

```
<pre class="wp-block-code">```basic
Event
| where TimeGenerated > ago(6h)
and Source == "WVD-Agent"
| sort by TimeGenerated desc
| project TimeGenerated, Computer, EventLog, EventID , EventLevelName, RenderedDescription, _ResourceId
```

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-6-1024x356.png)</figure>More information about Log Analytics and Windows event log check [Collect Windows event log data sources with Log Analytics agent.](https://docs.microsoft.com/en-us/azure/azure-monitor/platform/data-sources-windows-events)

<div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>## Monitor workbook

Using a monitor workbook can help creating a great overview. Although creating a complete workbook from scratch is not a part of the scope in this article, I will describe the basics from where to start.

First we need some dashboard parameters like subscription and hostpool name.   
Go to Azure Monitor, click Workbook and click an Empty workbook

<figure class="wp-block-image size-large">![empty-workbook](https://rozemuller.com/wp-content/uploads/2020/10/image-28.png)</figure>In the workbook click Add and choose Add Parameters

<figure class="wp-block-image size-large is-resized">![add-parameters](https://rozemuller.com/wp-content/uploads/2020/10/image-27.png)</figure>From there you will be able to create dynamic parameters by executing queries. For example when requesting all subscriptions you will need to execute an Azure Resource Graph query.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-8-1024x264.png)</figure>After creating the parameters add the query boxes via the Add button below and choose Add query. In this case I’ve used two simple queries.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-10-1024x155.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>```
<pre class="wp-block-code">```basic
Event
| where  Source == "WVD-Agent"
| summarize count() by Computer, EventID

Event
| where Source == "WVD-Agent"
| sort by TimeGenerated desc
| project TimeGenerated, Computer, EventLog, EventID , EventLevelName, RenderedDescription, _ResourceId
```

<div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-7-1024x112.png)</figure><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-9-1024x260.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>## Alerting

There are some options for getting alerts I like to show. The first option is by using PowerShell.

### Powershell

The script will need a WVD hostpool name and its resource group. All other information will found automatically. If there are results found the script will let you know.

```powershell
$HostpoolName = "Test-WVD-Host"
$ResourceGroup = "Test-WVD-ResourceGroup"

Try {
    $sessionHosts = Get-AzWvdSessionHost -ResourceGroupName $ResourceGroup -HostPoolName $HostpoolName
}
Catch {
    Throw "Error getting sessionhosts $_"
}

if ($sessionHosts) {
    Write-Host "Found session hosts $sessionHosts"
    $VirtualMachine = Get-AzResource -ResourceId $sessionHosts[0].ResourceId
    $ExtentionResult = (Get-AzVMExtension -VMName $VirtualMachine.Name -ResourceGroupName $VirtualMachine.ResourceGroupName -Name "OMSExtenstion")
    $WorkspaceId = ($ExtentionResult.PublicSettings | ConvertFrom-Json).workspaceId
    $query = @"
    Event
    | where TimeGenerated > ago(6h) and Source == 'WVD-Agent' 
    | sort by TimeGenerated desc 
    | project TimeGenerated, Computer, EventLog, EventID, EventLevelName, RenderedDescription, _ResourceId
"@
    $Results = Invoke-AzOperationalInsightsQuery -WorkspaceId $WorkspaceId -Query $Query
    if ($Results) {
        $Count = $($Results.Results).count
        Write-Warning "WVD Agent errors found! Total: $Count "
    }
    else {
        Write-Host "No errors found"
    }
}
else {
    Write-Error "No hosts found !"
}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>### Azure Monitor

Alert rules are rulesets in the Azure Monitor. Rules can be configured based on scopes (resource types). In this configuration I use the Log Analytics resource. Every resource has it own condition sets. When using Log Analytics you will able to run a custom log search, a user defined query.

#### Action groups

The common parts at every rule is an action group. This can be a webhook, email or ITSM tool. In this case I will configure an action group based on an e-mailaddress.   
I used the code below to deploy an action group first based on an ARM template.

```powershell
$TemplateFileLocation = 'https://github.com/srozemuller/Windows-Virtual-Desktop/blob/master/Azure-Monitor/deploy-actiongroup.json'
$TemplateParameters = @{
    actionGroupName = "Ag-MailToWVDAdmin"
    actionGroupShortName = "WVD"
    receiverName = "WVD Admin"
    receiverEmailAddress = "admin@wvd-ilike.it"
    tags = @{WVD = "TestEnvironment"}
}
$ActionGroup =  New-AzResourceGroupDeployment -ResourceGroupName $HostpoolResourceGroup -Name 'Deploy-ActionGroup-FromPowerShell' -TemplateUri $TemplateFileLocation @TemplateParameters
```

More information about creating action groups in the portal check the [Microsoft docs](https://docs.microsoft.com/nl-nl/azure/azure-monitor/platform/action-groups).

#### Action rule

After the alert group is configured all the needed parts are there to create the alert rule. As mentioned before I will use the Log Analytics resource and will configure a custom log search as condition.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-13.png)</figure><figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-14.png)</figure>In this case I use a simple query which search for Error events with a source WVD-Agent.

```
<pre class="wp-block-code">```basic
Event | where EventLevelName == 'Error' and Source == 'WVD-Agent' | sort by TimeGenerated
```

<div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>The last part is configuring the action. After clicking Add action groups, select the just created action group. At the end I configured an alert rule which will send me an e-mail if the result is above 0.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/01/image-16-1024x139.png)</figure>When finished the configuration the setup will look something like below.

<figure class="wp-block-image size-large">![](https://rozemuller.com/wp-content/uploads/2021/01/image-12-1024x698.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:35px"></div>### Automated

An option is to create an alert rule through the Azure portal. An another option is to create a rule automated, with PowerShell in this example. For a good start check the Microsoft docs about creating a [new schedule query rule](https://docs.microsoft.com/en-us/powershell/module/az.monitor/new-azscheduledqueryrule?view=azps-5.4.0). From there all the needed commands will explained. To get all the information I had to do some reverse engineering which results in a script like below.

```powershell
$HostpoolName = "Test-WVD-Host"
$ResourceGroup = "Test-WVD-ResourceGroup"

$hostpool = Get-AzWvdHostPool -name $HostpoolName -ResourceGroupName $HostpoolResourceGroup
$Query = "Event | where EventLevelName == 'Error' and Source == 'WVD-Agent' | sort by TimeGenerated"
$DataSourceId = (Get-AzDiagnosticSetting -ResourceId $hostpool.id).WorkspaceId
$Source = New-AzScheduledQueryRuleSource -Query  "Event | where EventLevelName == 'Error' and Source == 'WVD-Agent' | sort by TimeGenerated" -DataSourceId $DataSourceId
$Schedule = New-AzScheduledQueryRuleSchedule -FrequencyInMinutes 5 -TimeWindowInMinutes 5

# use the actiongroup variable from the previous step
$AznsAction = New-AzScheduledQueryRuleAznsActionGroup -ActionGroup $ActionGroup.Outputs.actionGroupResourceId.value -EmailSubject "WVD-Agent Eventlog Errors" -CustomWebhookPayload "{}"
$TriggerCondition = New-AzScheduledQueryRuleTriggerCondition -ThresholdOperator "GreaterThan" -Threshold 0
$AlertingAction = New-AzScheduledQueryRuleAlertingAction -AznsAction $AznsAction -Severity 1 -Trigger $TriggerCondition

$QueryRuleParameters = @{
    ResourceGroupName = $HostpoolResourceGroup
    Location = "West Europe"
    Enabled = $true
    Name = "WVD-Agent Eventlog Errors"
    Description = "Gets WVD-Agent Eventlog Errors from sessionhosts"
    Source = $Source
    Schedule = $Schedule
    Action = $alertingAction
}
New-AzScheduledQueryRule @QueryRuleParameters
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>## Prevent issues

In case of better safe then sorry the best way is to setup the Network Security Group (NSG) correctly. Most of the time outgoing secure traffic (HTTPS, port 443) is permitted. But in case of some limitations this is a way how to open the firewall with less destinations as possible.

### Network Security Group

In this part I will show a possible way how to configure the NSG in case of there are outgoing limitations.   
During the time the NSG had a lot of improvement. The option using destination service tags is one of them. Now WVD is a part for the Azure family a new service tag is available, WindowsVirtualDesktop. All other services tags are available as well. Using them will things make things a lot easier.

<figure class="wp-block-image size-large is-resized">![](https://rozemuller.com/wp-content/uploads/2021/01/image-15.png)</figure>I wrote a PowerShell function which will help added NSG rules automatically. The function will check the first deny rule and will place the needed rules above them.

```powershell
$NSGName = "NSG"
$ResourceGroupName = "ResourceGroup"

function add-firewallRule($NSG, $port, $ServiceTag) {
    # Pick random number for setting priority. It will exclude current priorities.
    $FirstDenyRule = ($NSG | Get-AzNetworkSecurityRuleConfig | where {$_.access -eq "Deny"} | select Priority).priority[0]
    $InputRange = 100..($FirstDenyRule-1)
    $priority = Get-Random -InputObject $InputRange 
    $nsgParameters = @{
        Name                     = "Allow-$ServiceTag-over-$port"
        Description              = "Allow port $port to $ServiceTag"
        Access                   = 'Allow'
        Protocol                 = "Tcp" 
        Direction                = "Outbound" 
        Priority                 = $priority 
        SourceAddressPrefix      = "*"
        SourcePortRange          = "*"
        DestinationAddressPrefix = $ServiceTag 
        DestinationPortRange     = $port
    }
    if ($NSG.SecurityRules.Name.Contains($nsgParameters.Name)){
        Write-Host "Rule already exists."
        
    }
    else {$NSG | Add-AzNetworkSecurityRuleConfig @NSGParameters  | Set-AzNetworkSecurityGroup }
}

$NSG = Get-AzNetworkSecurityGroup -name $NSGName -ResourceGroupName $ResourceGroupName
add-firewallRule -NSG $NSG -ServiceTag WindowsVirtualDesktop -port 443
```

<div aria-hidden="true" class="wp-block-spacer" style="height:50px"></div>At the end you are able to monitor WVD required URL’s.

More info about the safe URL list, Network Security Group, Azure Monitor check the links below:

Safe URL list: <https://docs.microsoft.com/en-us/azure/virtual-desktop/safe-url-list>  
Protect WVD: <https://docs.microsoft.com/en-us/azure/firewall/protect-windows-virtual-desktop>  
Azure Monitor: <https://docs.microsoft.com/nl-nl/azure/azure-monitor/overview>