nav2djs
========

#### 2D Navigation Widget ####

For full documentation, see [the ROS wiki](http://ros.org/wiki/nav2djs) or check out some [working demos](http://robotwebtools.org/).

[JSDoc](http://robotwebtools.org/jsdoc/nav2djs/current/) can be found on the Robot Web Tools website.

This project is released as part of the [Robot Web Tools](http://robotwebtools.org/) effort.

### Usage ###
Pre-built files can be found in either [nav2d.js](build/nav2d.js) or [nav2d.min.js](build/nav2d.min.js).

Alternatively, you can use the current release via the Robot Web Tools CDN ([full](http://cdn.robotwebtools.org/nav2djs/current/nav2d.js)) | ([min](http://cdn.robotwebtools.org/nav2djs/current/nav2d.min.js))

### Dependencies ###
nav2djs depends on:

[EventEmitter2](https://github.com/hij1nx/EventEmitter2). The current supported version is 0.4.11.
The current supported version can be found [in this project](include/EventEmitter2/eventemitter2.js) or on the Robot Web Tools CDN ([full](http://cdn.robotwebtools.org/EventEmitter2/0.4.11/eventemitter2.js)) | ([min](http://cdn.robotwebtools.org/EventEmitter2/0.4.11/eventemitter2.min.js))

[roslibjs](https://github.com/RobotWebTools/roslibjs). The current supported version is r4.
The current supported version can be found [in this project](include/roslibjs/roslib.js) or on the Robot Web Tools CDN ([full](http://cdn.robotwebtools.org/roslibjs/r4/roslib.js)) | ([min](http://cdn.robotwebtools.org/roslibjs/r4/roslib.min.js)).

[ros2djs](https://github.com/RobotWebTools/ros2djs). The current supported version is r1.
The current supported version can be found [in this project](include/ros2djs/ros2d.js) or on the Robot Web Tools CDN ([full](http://cdn.robotwebtools.org/ros2djs/r1/ros2d.js)) | ([min](http://cdn.robotwebtools.org/ros2djs/r1/ros2d.min.js)).

### Build ###
To build from source, use the provided [ANT script](utils/build.xml).

The script requires ANT, YUI Compressor, and JSDoc. To install these on an Ubuntu machine, use the following:

    sudo apt-get install ant yui-compressor jsdoc-toolkit

To run the build script, use the following:

    cd utils/
    ant

### License ###
nav2djs is released with a BSD license. For full terms and conditions, see the [LICENSE](LICENSE) file.

### Authors ###
See the [AUTHORS](AUTHORS) file for a full list of contributors.
