/*function testing(){
    chaining([
        "[@7.0.41200832@][1][1238430123625]/17__I3UIMF",
        "[@7.0.41200832@][1][1238430123625]/18__I5UIF",
        "[@7.0.41200832@][1][1238430123625]/18__I5UIMF"
    ], function(data){
        console.log(data);
    });
}

function chaining(list, callback){
    var i = 0,
        data = [];
    (function repeat(){
        sendRequest("GetShape", {shape_id: list[i]}, function(d){
            if(i++ < list.length){
                data.push(d);
                repeat();
            }else{
                callback(data);
            }
        });
    })();
}*/

function loadGoogleMaps() {
    var script = document.createElement("script"),
        GMKEY = "AIzaSyDgdkU0NXg128pOqzYfld2EGP3Sk3Gbnh0";
    script.type = "text/javascript";
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + GMKEY + "&sensor=true&callback=GMTEMP";
    document.body.appendChild(script);
}

function GMTEMP(){}

window.onload = loadGoogleMaps;

$(function(){
    $.mobile.buttonMarkup.hoverDelay = 50;

    if(location.hash != "" && location.hash != "#busArrival"){
        $.mobile.changePage("#busArrival");
    }

    Number.prototype.addZero = function(){
        return (this < 10 ? "0" : "") + this;
    };


    // $("#busRouteMapView").css({
    //     width: "100%",
    //     height: /*$(window).height()*0.75*/ "100%"
    // });

    //Settings Storage
    if(!localStorage["settings"]) localStorage["settings"] = JSON.stringify({
        favorites: []
    });


    //Load favorites
    (function loadFavorites(){
        var favorites = JSON.parse(localStorage["settings"]).favorites;
        if(favorites.length){
            $(favorites).each(function(){
                var li = $("<li>").appendTo("#favoriteStops");
                $("<a>").html(this.name).data({
                    name: this.name,
                    id: this.id,
                    code: this.code
                }).appendTo(li)
                .click(function () {
                    selectedStop = {
                        id: $(this).data("id"),
                        name: $(this).data("name"),
                        code: $(this).data("code")
                    };
                    $("#stopSearchResults").empty();
                    $.mobile.changePage("#busArrivalShow");
                    $("#stopSearchInput").val("");;
                });
            });
        }else{
            var li = $("<li>").appendTo("#favoriteStops").html("No favorite. Add by tapping the Star icon.").appendTo(li);
        }
        $('#favoriteStops').listview('refresh');
    })();


    const KEY = "77b92e5ceef640868adfc924c1735ac3";
    var stops = {};

    sendRequest("GetStops", {}, function(data){
        var list = data.stops;
        $(list).each(function(){
            stops[this.stop_id] = this;
        });
    }, function(err){
        alert("Can't reach MTD server. Please make sure you have a working and fast internet connection.");
        console.log("Error:", err);
    });

    function getStopDetails(name){
        parts = name.toUpperCase().split(":");
        var selected = stops[parts[0]];

        if(parts.length == 1){
            return selected;
        }else{
            var obj = selected;
            $(selected.stop_points).each(function(){
                if(this.stop_id == name){
                    obj = this;
                }
            });
            return obj;
        }
    }


    $("#templateHeader").clone().removeAttr("id").prependTo("[data-role=page]:not(.customHeader)");
    $("#templateHeader").remove();
    $("[data-role=page]:not(.customFooter)").each(function(){
        $("#templateFooter").clone().removeAttr("id").find("[href=#" + $(this).attr("data-linkName") + "]").addClass("ui-btn-active ui-state-persist").end().appendTo($(this));
    });
    $("#templateFooter").remove();


    var selectedStop = {
            id: null,
            name: null,
            code: null
        },
        liveUpdates = {
            lastUpdated: undefined,
            timeDisplayInterval: undefined,
            updateInterval: undefined        
        },
        CHECK_INTERVAL = 45000;



    $("#stopSearchInput").on("keyup", function (e) {
        if (/*e.keyCode == 13 && */this.value !== "") {
            $.ajax({
                url: "http://www.cumtd.com/autocomplete/stops/v1.0/json/search",
                dataType: "jsonp",
                data: {
                    query: $("#stopSearchInput").val()
                }
            }).done(function (data) {
                $("#stopSearchResults").empty();
                var list = data;
                if(!list.length){
                    $("<li>").html("No result").appendTo("#stopSearchResults");
                }
                $(list).each(function (i) {
                    var row = $("<li>").appendTo("#stopSearchResults");
                    $("<a>")
                        .html(this.n + " (" + this.c + ")")
                        .data({
                        "name": this.n,
                            "id": this.i,
                            "code": this.c
                    })
                        .appendTo(row)
                        .click(function () {
                        selectedStop = {
                            id: $(this).data("id"),
                            name: $(this).data("name"),
                            code: $(this).data("code")
                        };
                        $("#stopSearchResults").empty();
                        $.mobile.changePage("#busArrivalShow");
                        $("#stopSearchInput").val("");
                    });
                });
                $('#stopSearchResults').listview('refresh');
            });
        }else{
            $("#stopSearchResults").empty();
        }
    });

    $("#getAPIUsage").click(getAPIUsage);
    $("#gps").click(function(){
        $("#stopSearchResults").empty();
        $("<li>").html("Getting your location...").appendTo("#stopSearchResults");
        $('#stopSearchResults').listview('refresh');
        navigator.geolocation.getCurrentPosition(function(geo){
            var lat = geo.coords.latitude,
                lon = geo.coords.longitude;
            $("#stopSearchResults").empty();
            $("<li>").html("Searching for bus stops at " + lat + "," + lon).appendTo("#stopSearchResults");
            $('#stopSearchResults').listview('refresh');
            sendRequest("GetStopsByLatLon", {
                count: 3,
                lat: lat,
                lon: lon
            }, function(data){
                $("#stopSearchResults").empty();
                var list = data.stops;
                if(!list.length){
                    alert("No result.");
                    return false;
                }
                $(list).each(function (i) {
                    var row = $("<li>").appendTo("#stopSearchResults");
                    $("<a>")
                        .html(this.stop_name + " (" + this.code + ")")
                        .data({
                            "name": this.stop_name,
                            "id": this.stop_id,
                            "code": this.code
                        })
                        .appendTo(row)
                        .click(function () {
                            selectedStop = {
                                id: $(this).data("id"),
                                name: $(this).data("name"),
                                code: $(this).data("code")
                            };
                            $("#stopSearchResults").empty();
                            $.mobile.changePage("#busArrivalShow");
                            //getDepartureByStop(selectedStop.id);
                        });
                });
                $('#stopSearchResults').listview('refresh');
            });
        });    
    });
    
    $("#selectFromMap").click(function(){
        showGoogleMaps({
            title: "Select Stop"
        }, function(map){
            for(var key in stops){
                var midCoor = [0, 0, 0];
                $(stops[key].stop_points).each(function(){
                    midCoor[0] += this.stop_lat;
                    midCoor[1] += this.stop_lon;
                    midCoor[2]++;
                });
                (function(stop){
                    var mark = new google.maps.Marker({
                        position: new google.maps.LatLng(midCoor[0]/midCoor[2], midCoor[1]/midCoor[2]),
                        map: map,
                        title: stops[key].stop_name,
                        icon: 'http://silent-text-346.appspot.com/images/busstop.png'
                    });
                    google.maps.event.addListener(mark, 'click', function() {
                        selectedStop = {
                            id: stop,
                            name: stops[stop].stop_name,
                            code: stops[stop].code
                        }
                        $("#stopSearchResults").empty();
                        $.mobile.changePage("#busArrivalShow");
                    });
                    var infowindow = new google.maps.InfoWindow({
                        content: stops[stop].stop_name
                    });
                    google.maps.event.addListener(mark, 'mouseover', function() {
                        infowindow.open(map, mark);
                    });
                    google.maps.event.addListener(mark, 'mouseout', function() {
                        infowindow.close();
                    });
                })(key);
            }
        });
    });
    $("#addToFavorite").click(function(){
        var settings = JSON.parse(localStorage["settings"]);
        settings.favorites.push($.extend(selectedStop, {timestamp: +new Date()}));
        localStorage["settings"] = JSON.stringify(settings);
        createPopup({
            title: "Added to favorites.",
            buttons: [
                {
                    title: "OK",
                    onclick: function(popup){
                        console.log(popup);
                        popup.popup("close");
                    }
                }
            ]
        });
        
    });

    $("#busArrivalShow").on("pageshow", function(){
        getDepartureByStop(selectedStop.id);
    }).on("pagehide", function(){
        liveUpdates.timeDisplayInterval && clearInterval(liveUpdates.timeDisplayInterval);
        liveUpdates.updateInterval && clearInterval(liveUpdates.updateInterval);
        with(liveUpdates){
            lastUpdated = undefined;
            timeDisplayInterval = undefined;
            updateInterval = undefined;
        }
    });

    $("#routesData").on("pageshow", function(){
        sendRequest("getRoutes", {}, function(data){
            $("#busRoutes").empty();
            $(data.routes).each(function(){
                var entry = $("<li>").appendTo("#busRoutes"),
                    block = $("<a>").appendTo(entry);
                block
                    .html(this.route_long_name + " (" + this.route_short_name + ")")
                    .data("route", this)
                    .click(function(){
                        var mapView = $("#busRouteMapView");
                        mapView.empty();
                        sendRequest("GetTripsByRoute",{
                            route_id: $(this).data("route").route_id
                        }, function(data){
                            if(data.trips){

                                var analyze = {};
                                $(data.trips).each(function(i){
                                    if(analyze[this.shape_id]){
                                        analyze[this.shape_id].amount++;
                                        analyze[this.shape_id].direction = this.direction;
                                    }else{
                                        analyze[this.shape_id] = {amount: 1, direction: this.direction, shape_id: this.shape_id};
                                    }
                                });

                                var max = [0, 0],
                                    maxShapes = [undefined, undefined];
                                for(var key in analyze){
                                    if(analyze[key].amount > max[0]){
                                        maxShapes = [analyze[key], maxShapes[0]];
                                        max = [analyze[key].amount, max[0]];
                                    }else if(analyze[key].amount > max[1]){
                                        maxShapes[1] = analyze[key];
                                        max[1] = analyze[key].amount;
                                    }
                                }
                                console.log(maxShapes.slice(0));

                                if(maxShapes[0].direction == maxShapes[1].direction){
                                    maxShapes.pop();
                                    alert("Same direction.");
                                }
                                console.log(maxShapes.slice(0));

                                var i = 0,
                                    data = [];
                                (function repeat(callback){
                                    if(i < maxShapes.length){
                                        sendRequest("GetShape", {shape_id: maxShapes[i].shape_id}, function(d){
                                            data.push(d);
                                            i++;
                                            repeat(callback);
                                        });
                                    }else{
                                        callback(data);
                                    }
                                })(function(data){
                                    showGoogleMaps({}, function(map){

                                        var legend = $("<div>").css({background: "#FFF", border: "2px solid black", padding: 5});
                                        $(maxShapes).each(function(i){
                                            $("<div>").html(["Red", "Blue"][i] + ": " + maxShapes[i].direction).appendTo(legend);
                                        })
                                        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legend[0]);

                                        $(data).each(function(i){
                                            var coordinates = [];
                                            $(this.shapes).each(function(){
                                                coordinates.push(new google.maps.LatLng(this.shape_pt_lat, this.shape_pt_lon));
                                            });
                                            var path = new google.maps.Polyline({
                                                path: coordinates,
                                                strokeColor: ['#FF0000', '#0000FF'][i],
                                                strokeOpacity: 0.5,
                                                strokeWeight: 2,
                                                icons: [{
                                                    icon: {
                                                        path: "M -3 5 L 0 0 3 5",
                                                        scale: 1,
                                                        strokeColor: ['#FF0000', '#0000FF'][i],
                                                        strokeWeight: 2,
                                                        offset: "0px"
                                                    },
                                                    offset: "10px",
                                                    repeat: "100px"
                                                }]
                                            });

                                            path.setMap(map);
                                        });

                                    });
                                });

                                // sendRequest("GetShape", {
                                //     shape_id: data.trips[Math.floor(Math.random()*data.trips.length)].shape_id
                                // }, function(data){
                                //     showGoogleMaps({}, function(map){
                                //         var coordinates = [];
                                //         $(data.shapes).each(function(){
                                //             coordinates.push(new google.maps.LatLng(this.shape_pt_lat, this.shape_pt_lon));
                                //         })
                                //         var path = new google.maps.Polyline({
                                //             path: coordinates,
                                //             strokeColor: '#FF0000',
                                //             strokeOpacity: 1.0,
                                //             strokeWeight: 2
                                //         });

                                //         path.setMap(map);
                                //     });
                                // });
                            }
                        });
                    });
            });
            $('#busRoutes').listview('refresh');
        });
    });

    function showGoogleMaps(options, callback){
        var title = options.title || "Map View",
            mapView = $("#busRouteMapView").empty();

        $("#busRouteMap > div > h1").text(title);

        if(options.title) delete options.title;

        $("#busRouteMap").unbind("pageshow").on("pageshow", function(){
            $("#busRouteMap > div[data-role=content]").height(
                $(window).height() - $("#busRouteMap > div[data-role=header]").outerHeight()
            );
            console.log($("#busRouteMapView").parent().height());
            options = $.extend(
                {
                    zoom: 14,
                    center: new google.maps.LatLng(40.099, -88.226),
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    streetViewControl: false
                }, options),
            callback = callback || function(){};
            var map = new google.maps.Map(mapView[0], options);
            callback(map);

            navigator.geolocation.getCurrentPosition(function(coor){
                new google.maps.Marker({
                    position: new google.maps.LatLng(coor.coords.latitude, coor.coords.longitude),
                    map: map,
                    title:"You",
                    icon: 'http://silent-text-346.appspot.com/images/home.png',
                    zIndex: google.maps.Marker.MAX_ZINDEX + 1
                });
            });
        });

        $.mobile.changePage("#busRouteMap");
    }

    $("#reroutes").on("pageshow", function(){
        sendRequest("GetReroutes", {}, function(data){
            if(data.reroutes.length){
                $("#rerouteList").empty();
                $(data.reroutes).each(function(){
                    var entry = $("<li>").appendTo("#rerouteList"),
                        h3 = $("<h3>").appendTo(entry),
                        date = $("<p>").appendTo(entry),
                        p = $("<p>").appendTo(entry);
                    h3.text(this.message);
                    date.html(["From ", this.start_date, " to ", this.end_date].join(""));
                    p.html(this.description.replace(/\n/g, "<br>"));
                });
                $('#rerouteList').listview('refresh');
            }
        });
    });

    $("#customRequest").click(function(){
        var rq = prompt("Enter method:");
        if(rq){
            var data = prompt("Enter data:");
            if(data){
                sendRequest(rq, JSON.parse(data), function(d){
                    console.log(d);
                });
            }
        }
    });

    function sendRequest(action, data, callback, fail){
        fail = fail ? fail : function(){};
        $(".loadingImg").show();
        $.mobile.loading('show', {
            text: 'Loading...',
            textVisible: true,
            theme: 'a'
        });
        $.ajax({
            url: "http://developer.cumtd.com/api/v2.2/json/" + action,
            dataType: "jsonp",
            timeout: 10000,
            data: $.extend({key: KEY}, data)
        }).done(function(data){
            $(".loadingImg").hide();
            $.mobile.loading('hide');
            callback(data);
        }).fail(function(err){
            $(".loadingImg").hide();
            $.mobile.loading('hide');
            console.error("Error loading AJAX.");
            fail(err);
        });
    }
    window.sendRequest = sendRequest;

    function getDepartureByStop(id){
        sendRequest("GetDeparturesByStop", {stop_id: id}, function(data){
            liveUpdates.lastUpdated = new Date();
            liveUpdates.timeDisplayInterval = setInterval((liveInterval(), liveInterval), 1000);
            //Auto update
            liveUpdates.updateInterval = setTimeout(function(){
                getDepartureByStop(id);
                runFilter();
            }, CHECK_INTERVAL);
            var page = $("#busArrialResults").parent();
            if(data.status.code != 200){
                $(page).html(data.status.msg);
                return false;
            }
            $("#busArrivalDesc")
                .html("Showing buses at " + selectedStop.name + ":<br>(SMS code: " + selectedStop.code + " @ 35890)")
                .css("font-weight", "bold");
            
            $("#busArrialResults").empty();
            
            if(data.departures.length){
                var availablePlatforms = {},  //Store a list of stop platforms
                    availableDirections = {}, //Store a list of directions
                    availableRoutes = {};     //Store a list of routes
                $(data.departures).each(function(){
                    console.log(this);
                    var expMin = this.expected_mins,
                        expTime = new Date(this.expected),
                        routeName = this.headsign,
                        entry = $("<li>")
                            .appendTo("#busArrialResults")
                            .data("stop_id", this.stop_id)
                            .data("direction", (this.trip ? this.trip.direction : "N/A"))
                            .data("route", this.headsign),
                        block = $("<a>")
                            .data("location", this.location)
                            .data("vehicle", {
                                id: this.vehicle_id,
                                headsign: this.headsign
                            })
                            .appendTo(entry);
                    $("<span>")
                        .addClass("routeName")
                        .html(this.headsign)
                        .appendTo(block);
                    $("<div>")
                        .addClass("colorBlock")
                        .css({
                            width: 16,
                            height: 16,
                            display: "inline-block",
                            marginRight: 3,
                            background: "#" + this.route.route_color
                        })
                        .prependTo(block);
                    $("<span>")
                    .html(" - " + ((expMin) ? (expMin + " mins") : ("DUE")) + " (" + expTime.getHours().addZero() + ":" + expTime.getMinutes().addZero() + ")")
                        .appendTo(block);
                    
                    $(block).click(function(){
                        $.mobile.changePage("#vehicleDetailShow");
                        getVehicleById($(this).data("vehicle"));
                    });

                    availablePlatforms[this.stop_id] = true;
                    if(this.trip) availableDirections[this.trip.direction] = true;
                    availableRoutes[this.headsign] = true;
                });

                //Create <select> to filter stops
                availablePlatforms = Object.keys(availablePlatforms).sort();
                availableDirections = Object.keys(availableDirections).sort();
                availableRoutes = Object.keys(availableRoutes).sort();

                var block = $("<li>").attr("id", "filter").prependTo("#busArrialResults"),
                    select = $("<select>").appendTo(block),
                    all = $("<option>")
                            .attr("label", "All")
                            .data("filter",{
                                type: "all"
                            })
                            .html("All")
                            .appendTo(select);
                    platforms = $("<optgroup>").attr("label", "Platforms").appendTo(select),
                    directions = $("<optgroup>").attr("label", "Directions").appendTo(select)
                    routes = $("<optgroup>").attr("label", "Routes").appendTo(select);
                $(availablePlatforms).each(function(){
                    $("<option>")
                        .html(getStopDetails(this).stop_name)
                        .data("filter", {
                            type: "platforms",
                            value: this
                        })
                        .appendTo(platforms);
                });
                $(availableDirections).each(function(){
                    $("<option>")
                        .html(this)
                        .data("filter", {
                            type: "direction",
                            value: this
                        })
                        .appendTo(directions);
                });

                $(availableRoutes).each(function(){
                    $("<option>")
                        .html(this)
                        .data("filter", {
                            type: "route",
                            value: this
                        })
                        .appendTo(routes);
                });

                select.selectmenu({ mini: true });
                block.trigger("create");

                select.change(runFilter);

            }else{
                $("<li>").html("No bus route currently available.").appendTo("#busArrialResults");
            }
            $('#busArrialResults').listview('refresh');
        });
    }

    function runFilter(){
        var option = $("option:selected").data("filter"),
            list = $("#busArrialResults > li:not(#filter)");
        switch(option.type){
            case "all":
               list.stop().slideDown(700);
                break;
            case "platforms":
                $(list).each(function(){
                    if($(this).data("stop_id") == option.value){
                       $(this).stop().slideDown(700);
                    }else{
                        $(this).stop().slideUp(700);
                    }
                });
                break;
            case "direction":
                $(list).each(function(){
                    if($(this).data("direction") == option.value){
                       $(this).stop().slideDown(700);
                    }else{
                        $(this).stop().slideUp(700);
                    }
                });
                break;
            case "route":
                $(list).each(function(){
                    if($(this).data("route") == option.value){
                       $(this).stop().slideDown(700);
                    }else{
                        $(this).stop().slideUp(700);
                    }
                });
                break;
         }
    }

    function getVehicleById(v){
        sendRequest("GetVehicle", {
            vehicle_id: v.id
        }, function(data){
            if(data.vehicles.length){
                var bus = data.vehicles[0];
                $("#vehicleName").html(v.headsign);
                $("#vehicleId").html(bus.vehicle_id);
                $("#vehicleLanLon")
                    .html(bus.location.lat + "," + bus.location.lon)
                    .unbind("click")
                    .click(function(){
                        //showGoogleMap(bus.location);
                        showGoogleMaps({ center: gLoc(bus.location) }, function(map){
                            var marker = new google.maps.Marker({
                                position: gLoc(bus.location),
                                map: map
                            });
                            sendRequest("GetShape", {shape_id: bus.trip.shape_id}, function(data){
                                var min = -1, index = 0, pt = data.shapes,
                                    lonP = bus.location.lon, latP = bus.location.lat;
                                for(var i = 0; i < data.shapes.length; i++){
                                    var lon = pt[i].shape_pt_lon, lat = pt[i].shape_pt_lat;
                                    var d = distanceBetween(lat, lon, latP, lonP); //find min distance

                                    if(min == -1 || d < min){
                                        min = d; index = i;
                                    }
                                };
                                var paths = pt.slice(0);
                                paths.splice(index, 0, {
                                    shape_pt_lat: latP,
                                    shape_pt_lon: lonP
                                });
                                var passed = [], remaining = [];
                                for(var i = 0; i < index + 1; i++){
                                    passed.push(new google.maps.LatLng(paths[i].shape_pt_lat, paths[i].shape_pt_lon));
                                };
                                for(var i = index; i < paths.length; i++){
                                    remaining.push(new google.maps.LatLng(paths[i].shape_pt_lat, paths[i].shape_pt_lon));
                                };
                                new google.maps.Polyline({
                                    path: passed,
                                    strokeColor: '#555555',
                                    strokeOpacity: 0.6,
                                    strokeWeight: 2,
                                    icons: [{
                                        icon: {
                                            path: "M -3 5 L 0 0 3 5",
                                            scale: 1,
                                            strokeColor: '#555555',
                                            strokeWeight: 2,
                                            offset: "0px"
                                        },
                                        offset: "10px",
                                        repeat: "100px"
                                    }]
                                }).setMap(map);
                                new google.maps.Polyline({
                                    path: remaining,
                                    strokeColor: '#FF0000',
                                    strokeOpacity: 0.6,
                                    strokeWeight: 2,
                                    icons: [{
                                        icon: {
                                            path: "M -3 5 L 0 0 3 5",
                                            scale: 1,
                                            strokeColor: '#FF0000',
                                            strokeWeight: 2,
                                            offset: "0px"
                                        },
                                        offset: "10px",
                                        repeat: "100px"
                                    }]
                                }).setMap(map);
                            });
                        });
                    });

                var queryList = [
                    bus.previous_stop_id,
                    bus.next_stop_id,
                    bus.origin_stop_id,
                    bus.destination_stop_id];
                $([
                    $("#vehiclePrevStop"),
                    $("#vehicleNextStop"),
                    $("#vehicleDeparture"),
                    $("#vehicleDestination")
                ]).each(function(i){
                    var stopData = getStopDetails(queryList[i]);
                    this
                        .html(stopData.stop_name)
                        .css("font-weight", "bold")
                        .data("location", {
                            lat: stopData.stop_lat,
                            lon: stopData.stop_lon
                        })
                        .unbind("click")
                        .click(function(){
                            showGoogleMap($(this).data("location"));
                        });
                });
            }
        });
    }

    function liveInterval(){
        var d = new Date();
        $("#lastUpdated").html("(Last update: " + Math.round((d - liveUpdates.lastUpdated)/1000) + " secs ago)");
    }

    function getAPIUsage(){
        sendRequest("GetApiUsage", null, function(data){
            var opt = $("#getAPIUsageOutput");
            opt.empty();
            $("<pre>")
                .html(JSON.stringify(data, " ", 4))
                .appendTo(opt);
        });
    }

    function showGoogleMap(location){
          //window.open("https://www.google.com/maps?q=(" + location.lat + "%2C" + location.lon + ")", "_system");
        var point = new google.maps.LatLng(location.lat, location.lon);
        showGoogleMaps({center: point}, function(map){
            var marker = new google.maps.Marker({
                position: point,
                map: map
            });
        });
    }

    function gLoc(location){
        return new google.maps.LatLng(location.lat, location.lon);
    }

    function distanceBetween(lat1, lon1, lat2, lon2) {
        //Radius of the earth in:  1.609344 miles,  6371 km  | var R = (6371 / 1.609344);
        var R = 3958.7558657440545; // Radius of earth in Miles 
        var dLat = toRad(lat2-lat1);
        var dLon = toRad(lon2-lon1); 
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
                Math.sin(dLon/2) * Math.sin(dLon/2); 
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c;
        return d;
    }
    function toRad(Value) {
        /** Converts numeric degrees to radians */
        return Value * Math.PI / 180;
    }

    function createPopup(obj){
        obj = $.extend({
            title: "",
            text: "",
            buttons: []
        }, obj);

        var popup = $("<div>").popup({
            dismissible : false,
            theme : "a",
            overlyaTheme : "a",
            transition : "pop"
        }).bind("popupafterclose", function() {
            $(this).remove();
        });
        if(obj.title){
            $("<h2>").html(obj.title).appendTo(popup);
        }
        if(obj.text){
            $("<p>").html(obj.text).appendTo(popup);
        }
        var btns = $("<div>").css("text-align", "right").appendTo(popup);
        $(obj.buttons).each(function(){
            var btn = this;
            $("<button>").html(btn.title).attr("data-inline", "true")
            .click(function(){ btn.onclick(popup); }).appendTo(btns);
        });

        popup.popup("open").trigger("create");
    }

    //$("/*[data-role=page]*/ #busArrival").trigger('pagecreate');
    $.mobile.activePage.trigger('pagecreate');  
});