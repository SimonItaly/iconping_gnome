#!/bin/bash
# This script prepares the extension for a new release on extension.gnome.org

uuid=$(jq -r '.uuid' metadata.json)
version=$(jq -r '.version' metadata.json)

ls | grep -v packager.sh | grep -v README.md | grep -v *.zip | xargs zip -r $uuid.v$version.shell-extension.zip
