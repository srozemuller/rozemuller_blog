---
title: 'Resize AVD session host via Azure Monitor Alerts'
description: I show in this blog how to configure an external static WAN IP for AVD in an automated way with the use of an Azure Firewall.
date: 2022-09-01T07:55:46+02:00
author: 'Sander Rozemuller'
images:
- traffic-above.jpg
categories:
- "Azure Virtual Desktop"
- 'Network'
tags:
    - WAN
    - Azure
    - Firewall
type: "regular" # available types: [featured/regular]
draft: true
url: resize-avd-sessionhost-based-on-performance
Victor_Hugo: "true"
Focus_Keyword: "static wan ip avd"
---

{{< toc >}}

## Session host insights via Azure Monitor

Enable insights creates a data collection rule under Azure Monitor Settings. This rule captures performance log data and sends the data to a log analytics workspace. 

## Create alert rule from the logs


## Action group triggers function app

## Function app that resizes the session host

