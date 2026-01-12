---
title: "The Intune Automation Tasting — See, try, fly"
author: "Sander Rozemuller"
date: 2026-01-17T05:00:00+02:00
description: "Understanding how the Intune portal, Microsoft Graph, and automation fit together — starting from what you already know."
url: "/series/intune-automation-tasting-see-try-fly/"
images:
  - "images/post/series/intune-automation-tasting/image_color.jpg"
categories:
  - Intune
  - Automation
tags:
  - Microsoft Intune
  - Automation
  - Microsoft Graph
series:
  - The Intune Automation Tasting
series_order: 3
series_title: "The Intune Automation Tasting"
series_description: "A unique #MEMBEER tasting experience in world of Intune Automation — from light, safe foundations to full-bodied automation."
---


# See, try, fly
This is actually a process I very often use, in fact, I use it always. Everytime I want to automate things that I haven't seen before, I walk this route. So, learning the process and see every bit and byte.
No worries, at this stage, you don’t need to automate anything. We just focus on understanding how the portal and Graph relate to each other.

As mentioned, tools like Graph Explorer allow you to explore Microsoft Graph safely, see available endpoints, and retrieve real data from your tenant.

For many people, this is the first real *aha* moment:

*“So this policy I just created in the portal… this is how it looks in Graph.”*

That connection makes everything that follows much easier to understand.

## Starting your own exploration
To keep things simple, I recommend starting with Graph Explorer, https://developer.microsoft.com/en-us/graph/graph-explorer.  
It’s a free, web-based tool that allows you to interact with Microsoft Graph directly from your browser.
Graph Explorer comes pre-configured with permissions to read basic data from your tenant. That means you can start exploring right away without needing to set up authentication or permissions. But, for using Intune APIs, you will need to consent to additional permissions.


If Graph is the engine, the obvious question becomes:
**who is allowed to talk to it?**

That’s where identity, authentication, and permissions come in — and we’ll approach those just as deliberately and calmly.
