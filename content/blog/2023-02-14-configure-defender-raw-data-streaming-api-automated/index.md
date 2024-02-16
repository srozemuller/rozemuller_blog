---
title: "Block all traffic to Azure VM in case of bruteforce attack automated"
author: Sander Rozemuller
date: 2023-02-14T20:14:59+01:00
image: image.jpg
draft: false
url: "block-all-traffic-to-azure-vm-in-case-of-bruteforce-attack-automated"
categories:
- Azure
- Security
tags:
- Defender for Endpoint
- Automation
---
We all have been there, we created an Azure VM with RDP (port 3389) enabled on the outside. When using the Azure portal and enabling RDP all sources are allowed by default. Yes you will get a notice but often is just for test and you forgot limiting RDP connections to some IPs.
This is also happend to me. I deployed an Azure VM for test, and did not add my own IP address in the firewall. After a few days I got a message from Defender for Endpoint that tells my VM had some bruteforce attacks. Luckilly, I got a strong password so they didn't come in. But you don't want that kind of traffic hammering to your environment. 

In this blog I show a way how to trigger an automation sequence that blocks all RDP traffic to an Azure VM based on an Defender for Endpoint alert. 

{{< toc >}}

## Defender for Endpoint Alert


{{< bye >}}
