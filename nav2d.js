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
 *  Version: September 24, 2012
 *  
 *  Converted to AMD by Jihoon Lee
 *  Version: September 27, 2012
 *
 *********************************************************************/

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([ 'jquery', 'eventemitter2', 'actionclient', 'map' ], factory);
  } else {
    root.Nav2D = factory(root.jquery, root.EventEmitter2, root.ActionClient,
        root.Map);
  }
}
    (
        this,
        function(jquery, EventEmitter2, ActionClient, Map) {
          var Nav2D = function(options) {
            var nav2D = this;
            options = options || {};
            nav2D.ros = options.ros;
            nav2D.serverName = options.serverName || '/move_base';
            nav2D.actionName = options.actionName
                || 'move_base_msgs/MoveBaseAction';
            nav2D.serverTimeout = options.serverTimeout || 5000;
            _mapTopic = options.mapTopic || '/map';
            nav2D.continuous = options.continuous;
            _canvasID = options.canvasID;
            // optional (used if you do not want to stream /map or use a custom image)
            nav2D.image = options.image;
            _mapMetaTopic = options.mapMetaTopic || '/map_metadata';

            // icon information for displaying robot and click positions
            var _clickRadius = 1;
            var _clickUpdate = true;
            var _robotRadius = 1;
            var _robotRadiusGrow = true;

            // position information
            var _robotX;
            var _robotY;
            var _clickX;
            var _clickY;

            // map and meta data
            var _map;
            var _mapWidth;
            var _mapHeight;
            var _mapResolution;
            var _mapX;
            var _mapY;

            // flag to see if everything (map image, meta data, and robot pose) is available
            var _available = false;

            // grab the canvas and set the initial size of the canvas
            var _canvas = $('#' + _canvasID);
            _canvas.attr('width', options.width);
            _canvas.attr('height', options.height);

            // check if we need to fetch a map
            if (nav2D.image) {
              // set the image
              _map = new Image();
              _map.src = nav2D.image;

              // get the meta information
              var metaListener = new nav2D.ros.Topic({
                name : _mapMetaTopic,
                messageType : 'nav_msgs/MapMetaData'
              });
              metaListener.subscribe(function(metadata) {
                // set the metadata
                _mapWidth = metadata.width;
                _mapHeight = metadata.height;
                _mapResolution = metadata.resolution;
                _mapX = metadata.origin.position.x;
                _mapY = metadata.origin.position.y;
              });
            } else {
              // create a map object
              _mapFetcher = new Map({
                ros : nav2D.ros,
                mapTopic : _mapTopic,
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
            var poseListener = new nav2D.ros.Topic({
              name : '/robot_pose',
              messageType : 'geometry_msgs/Pose'
            });
            poseListener
                .subscribe(function(pose) {
                  // only update once we know the map metadata
                  if (_mapWidth && _mapHeight && _mapResolution) {
                    // get the current canvas size
                    var canvasWidth = _canvas.attr('width');
                    var canvasHeight = _canvas.attr('height');

                    // set the pixel location with (0, 0) at the top left
                    _robotX = ((pose.position.x - _mapX) / _mapResolution)
                        * (canvasWidth / _mapWidth);
                    _robotY = canvasHeight
                        - (((pose.position.y - _mapY) / _mapResolution) * (canvasHeight / _mapHeight));

                    if (!_available) {
                      _available = true;
                      // notify the user we are avaiable
                      nav2D.emit('available');
                      // set the interval for the draw function
                      nav2D.interval = setInterval(nav2D.draw, 30);
                    }
                  }
                });

            // setup the actionlib client
            var actionClient = new ActionClient({
              ros : nav2D.ros,
              actionName : nav2D.actionName,
              serverName : nav2D.serverName,
              timeout : 5000
            });
            // pass the event up
            actionClient.on('timeout', function() {
              nav2D.emit('timeout');
            });

            // create a cancel
            nav2D.cancel = function() {
              actionClient.cancel();
            };

            // create the draw function
            nav2D.draw = function() {
              // grab the drawing context
              var context = _canvas[0].getContext('2d');

              // grab the current sizes
              var width = _canvas.attr('width');
              var height = _canvas.attr('height');

              // clear the canvas
              context.clearRect(0, 0, width, height);

              // check for the map
              if (_map) {
                // add the image back to the canvas
                context.drawImage(_map, 0, 0, width, height);
              }

              // check if the user clicked yet
              if (_clickX && _clickY) {
                // draw the click point
                context.fillStyle = '#543210';
                context.beginPath();
                context.arc(_clickX, _clickY, _clickRadius, 0, Math.PI * 2,
                    true);
                context.closePath();
                context.fill();

                // grow half the speed of the refresh rate
                if (_clickUpdate) {
                  _clickRadius++;
                }

                // reset at 5 (i.e., blink)
                if (_clickRadius == 5) {
                  _clickRadius = 1;
                }

                _clickUpdate = !_clickUpdate;
              }

              // draw the robot location
              if (_robotX && _robotY) {
                // draw the click point
                context.fillStyle = '#012345';
                context.beginPath();
                context.arc(_robotX, _robotY, _robotRadius, 0, Math.PI * 2,
                    true);
                context.closePath();
                context.fill();

                // grow and shrink the icon
                if (_robotRadiusGrow) {
                  _robotRadius++;
                } else {
                  _robotRadius--;
                }

                if (_robotRadius == 10 || _robotRadius == 1) {
                  _robotRadiusGrow = !_robotRadiusGrow;
                }
              }
            };

            nav2D.getPoseFromEvent = function(e) {
              // only go if we have the map data
              if (_mapWidth > -1 && _mapHeight > -1 && _mapResolution > -1) {
                // get the y location with (0, 0) at the top left for
                // drawing
                _clickX = e.pageX - _canvas.offset().left;
                _clickY = e.pageY - _canvas.offset().top;

                // convert the pixel location to a pose
                var canvasWidth = _canvas.attr('width');
                var canvasHeight = _canvas.attr('height');
                var x = (_clickX * (_mapWidth / canvasWidth) * _mapResolution)
                    + _mapX;
                var y = ((canvasHeight - _clickY) * (_mapHeight / canvasHeight) * _mapResolution)
                    + _mapY;
                return [ x, y ];
              } else
                return null;
            };

            nav2D.sendGoalPose = function(x, y) {

              // create a goal
              var goal = new actionClient.Goal({
                target_pose : {
                  header : {
                    frame_id : "/map"
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
              //goal.send();

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

            // set the double click action
            _canvas.dblclick(function(e) {
              var poses = nav2D.getPoseFromEvent(e);
              if (poses != null) {
                nav2D.sendGoalPose(poses[0], poses[1]);
              } else {
                nav2D.ros.emit('error', "Error in getPoseFromEvent");
                console.log("Error");
              }
            });
          };
          Nav2D.prototype.__proto__ = EventEmitter2.prototype;
          return Nav2D;
        }));
