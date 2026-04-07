#!/bin/bash

# Set proper permissions for node_modules binaries
chmod +x node_modules/.bin/*

# Run the build
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build completed successfully!"
else
    echo "Build failed!"
    exit 1
fi
