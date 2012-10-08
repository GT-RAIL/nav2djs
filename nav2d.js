/*********************************************************************
 *
 * Software License Agreement (BSD License)
 *
 *  Copyright (c) 2012, Worcester Polytechnic Institute
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *   * Redistributions in binary form must reproduce the above
 *     copyright notice, this list of conditions and the following
 *     disclaimer in the documentation and/or other materials provided
 *     with the distribution.
 *   * Neither the name of the Worcester Polytechnic Institute nor the 
 *     names of its contributors may be used to endorse or promote 
 *     products derived from this software without specific prior 
 *     written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 *  FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 *  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 *  BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 *  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 *  CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 *  LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 *  ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 *
 *   Author: Russell Toris
 *  Version: October 8, 2012
 *  
 *  Converted to AMD by Jihoon Lee
 *  Version: September 27, 2012
 *
 *********************************************************************/

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([ 'eventemitter2', 'actionclient', 'map' ], factory);
  } else {
    root.Nav2D = factory(root.EventEmitter2, root.ActionClient, root.Map);
  }
}
    (
        this,
        function(EventEmitter2, ActionClient, Map) {
          var Nav2D = function(options) {
            var nav2D = this;
            options = options || {};
            nav2D.ros = options.ros;
            nav2D.serverName = options.serverName || '/move_base';
            nav2D.actionName = options.actionName
                || 'move_base_msgs/MoveBaseAction';
            nav2D.serverTimeout = options.serverTimeout || 5000;
            nav2D.mapTopic = options.mapTopic || '/map';
            nav2D.continuous = options.continuous;
            nav2D.canvasID = options.canvasID;
            // optional (used if you do not want to stream /map or use a custom image)
            nav2D.image = options.image;
            nav2D.mapMetaTopic = options.mapMetaTopic || '/map_metadata';
            // optional color settings
            nav2D.clickColor = options.clickColor || '#543210';
            nav2D.robotColor = options.robotColor || '#012345';

            // icon information for displaying robot and click positions
            var _clickRadius = 1;
            var _clickUpdate = true;
            var maxClickRadius = 5;
            var _robotRadius = 1;
            var _robotRadiusGrow = true;
            var maxRobotRadius = 10;

            // position information
            var _robotX;
            var _robotY;
            var _clickX;
            var _clickY;

            // map and metadata
            var _map;
            var _mapWidth;
            var _mapHeight;
            var _mapResolution;
            var _mapX;
            var _mapY;
            var _drawInterval;

            // flag to see if everything (map image, metadata, and robot pose) is available
            var _available = false;

            // grab the canvas
            var _canvas = document.getElementById(nav2D.canvasID);

            // check if we need to fetch a map or if an image was provided
            if (nav2D.image) {
              // set the image
              _map = new Image();
              _map.src = nav2D.image;

              // get the meta information
              var metaListener = new nav2D.ros.Topic({
                name : nav2D.mapMetaTopic,
                messageType : 'nav_msgs/MapMetaData'
              });
              metaListener.subscribe(function(metadata) {
                // set the metadata
                _mapWidth = metadata.width;
                _mapHeight = metadata.height;
                _mapResolution = metadata.resolution;
                _mapX = metadata.origin.position.x;
                _mapY = metadata.origin.position.y;

                // we only need the metadata once
                metaListener.unsubscribe();
              });
            } else {
              // create a map object
              var _mapFetcher = new Map({
                ros : nav2D.ros,
                mapTopic : nav2D.mapTopic,
                continuous : nav2D.continuous
              });
              _mapFetcher.on('available', function() {
                // store the image
                _map = _mapFetcher.image;

                // set the metadata
                _mapWidth = _mapFetcher.info.width;
                _mapHeight = _mapFetcher.info.height;
                _mapResolution = _mapFetcher.info.resolution;
                _mapX = _mapFetcher.info.origin.position.x;
                _mapY = _mapFetcher.info.origin.position.y;
              });
            }

            // setup a listener for the robot pose
            var _poseListener = new nav2D.ros.Topic({
              name : '/robot_pose',
              messageType : 'geometry_msgs/Pose'
            });
            _poseListener
                .subscribe(function(pose) {
                  // only update once we know the map metadata
                  if (_mapWidth && _mapHeight && _mapResolution) {
                    // get the current canvas size
                    var canvasWidth = _canvas.getAttribute('width');
                    var canvasHeight = _canvas.getAttribute('height');

                    // set the pixel location with (0, 0) at the top left
                    _robotX = ((pose.position.x - _mapX) / _mapResolution)
                        * (canvasWidth / _mapWidth);
                    _robotY = canvasHeight
                        - (((pose.position.y - _mapY) / _mapResolution) * (canvasHeight / _mapHeight));

                    // check if this is the first time we have all information
                    if (!_available) {
                      _available = true;
                      // notify the user we are available
                      nav2D.emit('available');
                      // set the interval for the draw function
                      _drawInterval = setInterval(_draw, 30);
                    }
                  }
                });

            // setup the actionlib client
            var _actionClient = new ActionClient({
              ros : nav2D.ros,
              actionName : nav2D.actionName,
              serverName : nav2D.serverName,
              timeout : nav2D.serverTimeout
            });
            // pass the event up
            _actionClient.on('timeout', function() {
              nav2D.emit('timeout');
            });

            // create a cancel
            nav2D.cancel = function() {
              _actionClient.cancel();
            };

            // create the draw function
            var _draw = function() {
              // grab the drawing context
              var context = _canvas.getContext('2d');

              // grab the current sizes
              var width = _canvas.getAttribute('width');
              var height = _canvas.getAttribute('height');

              // add the image back to the canvas
              context.drawImage(_map, 0, 0, width, height);

              // check if the user clicked yet
              if (_clickX && _clickY) {
                // draw the click point
                context.fillStyle = nav2D.clickColor;
                context.beginPath();
                context.arc(_clickX, _clickY, _clickRadius, 0, Math.PI * 2,
                    true);
                context.closePath();
                context.fill();

                // grow half the speed of the refresh rate
                if (_clickUpdate) {
                  _clickRadius++;
                }

                // reset at the threshold (i.e., blink)
                if (_clickRadius == maxClickRadius) {
                  _clickRadius = 1;
                }

                _clickUpdate = !_clickUpdate;
              }

              // draw the robot location
              context.fillStyle = nav2D.robotColor;
              context.beginPath();
              context.arc(_robotX, _robotY, _robotRadius, 0, Math.PI * 2, true);
              context.closePath();
              context.fill();

              // grow and shrink the icon
              if (_robotRadiusGrow) {
                _robotRadius++;
              } else {
                _robotRadius--;
              }
              if (_robotRadius == maxRobotRadius || _robotRadius == 1) {
                _robotRadiusGrow = !_robotRadiusGrow;
              }
            };

            // get the position in the world from a point clicked by the user
            nav2D.getPoseFromEvent = function(event) {
              // only go if we have the map data
              if (_available) {
                // get the y location with (0, 0) at the top left
                var offsetLeft = 0;
                var offsetTop = 0;
                var element = _canvas;
                while (element && !isNaN(element.offsetLeft)
                    && !isNaN(element.offsetTop)) {
                  offsetLeft += element.offsetLeft - element.scrollLeft;
                  offsetTop += element.offsetTop - element.scrollTop;
                  element = element.offsetParent;
                }
                _clickX = event.pageX - offsetLeft;
                _clickY = event.pageY - offsetTop;

                // convert the pixel location to a pose
                var canvasWidth = _canvas.getAttribute('width');
                var canvasHeight = _canvas.getAttribute('height');
                var x = (_clickX * (_mapWidth / canvasWidth) * _mapResolution)
                    + _mapX;
                var y = ((canvasHeight - _clickY) * (_mapHeight / canvasHeight) * _mapResolution)
                    + _mapY;
                return [ x, y ];
              } else {
                return null;
              }
            };

            // a function to send the robot to the given goal location
            nav2D.sendGoalPose = function(x, y) {
              // create a goal
              var goal = new _actionClient.Goal({
                target_pose : {
                  header : {
                    frame_id : '/map'
                  },
                  pose : {
                    position : {
                      x : x,
                      y : y,
                      z : 0
                    },
                    orientation : {
                      x : 0,
                      y : 0,
                      z : 0.6,
                      w : 0.8
                    }
                  }
                }
              });
              goal.send();

              // pass up the events to the user
              goal.on('result', function(result) {
                nav2D.emit('result', result);

                // clear the click icon
                _clickX = null;
                _clickY = null;
              });
              goal.on('status', function(status) {
                nav2D.emit('status', status);
              });
              goal.on('feedback', function(feedback) {
                nav2D.emit('feedback', feedback);
              });
            };

            _canvas
                .addEventListener(
                    'dblclick',
                    function(event) {
                      var poses = nav2D.getPoseFromEvent(event);
                      if (poses != null) {
                        nav2D.sendGoalPose(poses[0], poses[1]);
                      } else {
                        nav2D
                            .emit('error',
                                "All of the necessary navigation information is not yet available.");
                      }
                    });
          };
          Nav2D.prototype.__proto__ = EventEmitter2.prototype;
          return Nav2D;
        }));
