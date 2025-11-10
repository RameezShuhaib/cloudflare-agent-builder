# Configuration Management

## Overview

The configuration management system allows you to store and reuse credentials, API keys, and other variables across workflows without hardcoding them.

## Key Features

- **Secure Storage**: Variables stored in encrypted KV
- **Metadata in D1**: Config names, descriptions stored in D1
- **Default Configs**: Set default config per workflow
- **Execution Override**: Override config at execution time
- **Partial Updates**: PATCH to merge, PUT to replace
- **Granular Control**: Update/delete individual variables

## Template Access

Access config variables using `{{config.variable_name}}` in any node configuration.

## Complete Documentation

See full examples and best practices in the main README.md
