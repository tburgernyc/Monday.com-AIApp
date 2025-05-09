## APP_VERSIONING.md

```markdown
# App Versioning Guide for Claude AI Assistant

This guide outlines our approach to versioning the Claude AI Assistant for Monday.com, ensuring smooth updates and maintaining backward compatibility.

## Versioning Strategy

The Monday.com app versioning system allows you to safely add, change, or remove functionality without disrupting existing users. It uses a single type of version for all changes, whether updating permissions, adding features, fixing bugs, or making other modifications.

### Version Numbering

Our version numbering follows the format: `v{number}` (e.g., v1, v2, v3)

* New version numbers automatically increment based on your app's highest version number
* The app begins at version 1.0.0 by default

## Creating New Versions

To create a new version:

1. In the Developer Center, navigate to the "App Versions" tab
2. Click "New Version" to create a draft version
3. Make the necessary changes to your app configuration
4. Test thoroughly before promoting to live

The draft version inherits all configurations from your app's current live version, including scopes, OAuth settings, features, and app name. You'll need to manually update anything you want to change.

## Promoting Versions to Live

When you're ready to release your changes:

1. In the Developer Center, navigate to the "App Versions" tab
2. Click the three dots next to your draft version and select "Publish"
3. Alternatively, click the "Promote to live" button under your app's name

Once your version is live, it will automatically push updates to users. However, changes to permissions or scopes require manual approval from users.

## Managing Backward Compatibility

Since users may be running different versions of your app (especially if they haven't approved permission changes), your backend must support all live versions:

1. Implement version detection in your API endpoints
2. Handle different permission sets gracefully
3. Account for feature differences between versions
4. Provide clear error messages when a user tries to access a feature they don't have permission for

## Version Maintenance

To keep your app versions organized:

1. Delete draft versions when no longer needed by clicking the three dots next to the version and selecting "Delete"
2. You cannot delete live or deprecated versions
3. Document each version's changes in a changelog for reference

## Best Practices

1. **Test Thoroughly**: Test each new version in a development environment before promoting to live
2. **Incremental Changes**: Make smaller, incremental changes rather than massive overhauls
3. **Clear Documentation**: Document all changes for both internal reference and user communication
4. **Versioned API Endpoints**: Consider versioning your API endpoints to support multiple app versions simultaneously
5. **Graceful Degradation**: If a user hasn't approved new permissions, provide a graceful fallback experience

## Handling Permission Changes

When you update permissions or scopes, users are notified via an in-app banner that prompts them to approve the changes. Users can continue accessing the app without approving, but some features may not work properly.

To handle this scenario:

1. Check which permissions a user has approved via the `permissions` property of your app's context
2. Implement error handling for failed API requests when required permissions aren't granted
3. Provide clear guidance to users on what permissions they need to approve to use specific features

## Monitoring Version Adoption

Track the adoption of your new versions to understand user behavior and identify potential issues:

1. Monitor the percentage of users who have upgraded to the latest version
2. Track users who have approved permission changes
3. Analyze error rates and support requests related to version changes

## Version Rollback Plan

In case of critical issues with a new version:

1. Prepare a new version that fixes the issues
2. Promote the fixed version to live as quickly as possible
3. Communicate with affected users about the issue and fix

## Additional Resources

- [Monday.com App Versioning Documentation](https://developer.monday.com/apps/docs/app-versioning)
- [Monday.com Developer Center](https://developer.monday.com)