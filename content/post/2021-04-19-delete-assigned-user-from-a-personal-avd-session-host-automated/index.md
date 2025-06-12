---
title: 'Delete assigned user from a personal AVD session host automated'
date: '2021-04-19T13:18:21+02:00'
author: 'Sander Rozemuller'
url: delete-assigned-user-from-a-personal-avd-session-host-automated
images:
- images/post/delete-assigned-user-from-a-personal-avd-session-host-automated/avd-recycle-scaled.jpg
categories:
    - 'Azure Virtual Desktop'
    - Entra ID
tags:
    - Azure Virtual Desktop
    - Hostpool
    - PowerShell
    - SessionHost
    - UserManagement
---

An Azure Virtual Desktop environment has two types of host pools, a pooled and a personal type. The main difference between them is the user assignment. In this article I will show how to deal with personal assigned session hosts and how to delete the assigned user and will save work.

## Introduction

At some day we all run to it. You are logging in to a AVD environment, through the web or client, and like to start a session. After logging in you noticed this is the wrong user, an admin user or a test user for example. Or someone is leaving the organisation or get a new user account. These are things which happens all the time and that’s OK :).   
In case of an AVD pooled environment it is still fine, you will logout your session. On a AVD personal environment it is a bit uncomfortable because the session host is claimed by a user and can not be used by someone else.   
In this article I will explain how to delete an assigned user from a personal AVD session host. This will save removing and adding session hosts.   
  
*Good to know is that in the portal there is no option to remove a user from a session host and have to be done manually, at least till now.*

{{< toc >}}

## Host pool types explained

As mentioned a AVD environment has two types of host pools, a pooled and a personal type.   
The main difference is how the session hosts are used.

### Pooled

A pooled environment has several users are using the same session host. When selecting the pooled type the portal will give you an extra option, Load balancing algorithm, where to select how to balance users over the session hosts.   
  
In a Breath-First situation the environment will added session like the old round-robin way and will add session equal over all the session hosts.   
In a Depth-First situation every new session is assigned to next available session host which has not reached its limit.   
  
For example:  
You have 3 session hosts with a max session limit of 10. The first session host has 8 sessions, the second has 4 and the last has 7. In a breath-first the next session is assigned to the second host (with 4 sessions). In case of depth-first the first session host (with 8 sessions) will be used.

<figure class="wp-block-image size-large">![wvd pooled hostpool type](https://www.rozemuller.com/wp-content/uploads/2021/04/image-7.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>### Personal

In a personal environment there is no load balancing. Every user has its own session host. The only thing which can be configured is the assignment type, automatically or direct. There could be reasons to choose the direct option but most of the time the automatically option will good.

<figure class="wp-block-image size-full is-resized">![wvd hostpool types](https://www.rozemuller.com/wp-content/uploads/2021/04/image-6.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>More information about host pool load balancing you can check the [Microsoft documentation about these methods](https://docs.microsoft.com/en-us/azure/virtual-desktop/host-pool-load-balancing).

What happens if a user logs in, an available session host will be assigned to that user and will keep it as long as the session host exists. A great advantage in relation to a pooled environment is that you are able [enable start VM on connect](https://www.rozemuller.com/configure-wvd-start-vm-on-connect-automated-with-role-assignments-and-graph-api/) and shutdown the session hosts at the end of the day. This will save consumption and so costs.

<figure class="wp-block-image size-large is-resized">![](https://www.rozemuller.com/wp-content/uploads/2021/04/image-9-1024x87.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>An disadvantage is that when a user is leaving, needs a new login name or in my case, I logged in with a wrong test user, the session host is claimed by that user account. Of course you can delete that session host and create a new one but some side effects are you will have to clean up your Active Directory and remove all related resources as well.   
So I like to remove that user from the host without creating a new VM and all other.

## Delete assigned from personal session host

Now it is time to remove an assigned user from a session host. What is happening in the basic is that we will re-register the session host into the host pool. In the first step we will create a new host pool token.

### Generate host pool token

Before we are able to register session hosts into a host pool we have to create a new host pool token. This is a global unique id which represents the host pool as long the token is available. This token will be used by the RDInfra agent which will search in the Azure cloud for a host pool with this token and then will add the session host to the host pool.  
  
There are several way to create a new token. Through the portal under the host pool overview.

<figure class="wp-block-image size-large">![](https://www.rozemuller.com/wp-content/uploads/2021/04/image-11.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>Or by PowerShell via the command below. (I will generate a new token for 30 minutes in this case). I will save the token into a $token variable to use it later.

```powershell
$now = get-date
$Parameters = @{
    HostpoolName      = 'hostpool-intune-personal'
    ResourceGroupName = 'rg-wvd-001' 
}
$token = New-AzWvdRegistrationInfo @Parameters -ExpirationTime $now.AddMinutes(30)
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>### Finding the user’s session host

The next step is to find the session host with the user which need to be removed. This can be done by executing the Get-AzWvdSessionHost command and will result in the session host information.

```powershell
$sessionHost = Get-AzWvdSessionHost @Parameters | where {$_.AssignedUser -eq 'useraccount'} | FL
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div><figure class="wp-block-image size-full is-resized">![](https://www.rozemuller.com/wp-content/uploads/2021/04/image-10.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>Important is that the session host needs to be removed from the host pool. (Not the VM it self)  
Execute the command below to remove the session host.

```powershell
$sessionHost | Remove-AzWvdSessionHost
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>### Change registry values

Now we have a new token and the correct session host it is time to re-register the host. To achieve that goal there are also some options. Option 1 is re-installing the RDInfra agent. When installing the agent you will be asked for the new token.   
In my case I decided to change the needed registry keys so the agent will register after a reboot.   
Because I like the automated way I will execute some commands remotely on the virtual machine with the Invoke-AzRunCommand PowerShell command.

Beforce running the Invoke command we need the correct virtual machine name. In the step before we found the correct session host. Each session host has a resourceId, don’t get confused by the Id, which can be used to find the Azure resource with the Get-AzResource command. After finding the correct resource we will have a name and a resource group name.   
The $token.token value is the value from the [generate host pool token part](#generate-token).

```powershell
$vm = Get-AzResource -ResourceId $sessionHost.ResourceId
Invoke-AzVMRunCommand -ResourceGroupName $vm.ResourceGroupName -VMName $vm.Name -CommandId 'RunPowerShellScript' -ScriptPath .\delete-wvdassigneduser.ps1 -Parameter @{HostpoolToken = $token.token}
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>An Invoke-AzVmRunCommand in combination with the commandId ‘RunPowerShellScript’ will need a PowerShell script. See the script I used below. This script will be downloaded by the VM and executed on the VM. As you can see the script accepts the host pool token.

```powershell
[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$HostpoolToken
)

Set-ItemProperty -Path "HKLM:\Software\Microsoft\RDInfraAgent" -Name "RegistrationToken" -Value $HostpoolToken
Set-ItemProperty -Path "HKLM:\Software\Microsoft\RDInfraAgent" -Name "IsRegistered" -Value 0
```

<div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>### Restart session host

The final step is restarting the VM

```powershell
Get-AzVM -Name $vm.Name | Restart-AzVm
```

The final result is a clean session host for a new user.

<figure class="wp-block-image size-full is-resized">![](https://www.rozemuller.com/wp-content/uploads/2021/04/image-12.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div><figure class="wp-block-image size-full is-resized">![](https://www.rozemuller.com/wp-content/uploads/2021/04/image-13.png)</figure><div aria-hidden="true" class="wp-block-spacer" style="height:30px"></div>  
The change-sessionhost-token.ps1 script can be find at my [Github repository](https://github.com/srozemuller/Windows-Virtual-Desktop/blob/master/Recycle/UserAssignment/change-sessionhost-token.ps1)

Thank you for reading my blog post about delete an assign user from a personal Windows Virtual Desktop session host.