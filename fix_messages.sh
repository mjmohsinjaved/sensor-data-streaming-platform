#!/bin/bash
# Script to clean commit messages
git filter-branch -f --msg-filter 'perl -pe "s/\n.*Generated with.*//g; s/\n.*Co-Authored-By: Claude.*//g"' -- --all