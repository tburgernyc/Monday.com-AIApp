# Multi-Region Support for Monday.com Claude Integration App

This guide explains how to configure and deploy the Monday.com Claude Integration App for multi-region support, ensuring your app can operate in both US and EU data regions.

## Overview

Monday.com offers hosting in both US and EU regions to comply with data residency requirements. For marketplace apps to be fully supported, they must be deployable to both regions. This guide covers the necessary steps to make your app multi-region compatible.

## Prerequisites

- Monday.com developer account
- Monday.com app set up in the Developer Center
- Monday code CLI installed and configured
- Understanding of your app's architecture and data flow

## Configuration Steps

### 1. Update Environment Configuration

Modify your app's environment configuration to support region-specific settings:

```javascript
// Environment variables structure
{
  "US": {
    "API_ENDPOINT": "https://api.monday.com/v2",
    "CLAUDE_API_URL": "https://api.anthropic.com/v1/messages",
    "LOG_LEVEL": "info"
  },
  "EU": {
    "API_ENDPOINT": "https://api.eu1.monday.com/v2",
    "CLAUDE_API_URL": "https://api.anthropic.com/v1/messages", 
    "LOG_LEVEL": "info"
  }
}