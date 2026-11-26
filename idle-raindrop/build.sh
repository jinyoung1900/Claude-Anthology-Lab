#!/bin/sh
# Builds without Android Studio, using the Gradle that ships with Unity. Usage: sh build.sh assembleDebug
# Add --offline to build without the network.
cd "$(dirname "$0")" || exit 1
export JAVA_HOME="${JAVA_HOME:-/c/Program Files/Eclipse Adoptium/jdk-17.0.17.10-hotspot}"
L='C:\Program Files\Unity\Hub\Editor\6000.0.85f1\Editor\Data\PlaybackEngines\AndroidPlayer\Tools\gradle\lib'
"$JAVA_HOME/bin/java" -cp "$L\gradle-gradle-cli-main-9.3.1.jar" org.gradle.launcher.GradleMain "$@"
