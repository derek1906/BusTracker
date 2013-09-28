function testing(){
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
}

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

    if(location.hash != "" && location.hash != "#busArrival"){
        $.mobile.changePage("#busArrival");
    }

    Number.prototype.addZero = function(){
    	return (this < 10 ? "0" : "") + this;
    };


    $("#busRouteMapView").css({
        width: "100%",
        height: $(window).height()*0.75
    });



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
    $("[data-role=page]").each(function(){
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



    $("#stopSearchInput").on("keydown", function (e) {
        $("#stopSearchResults").empty();
        if (e.keyCode == 13 && this.value !== "") {
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
                    });
                });
                $('#stopSearchResults').listview('refresh');
            });
        }
    })
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
                                                strokeWeight: 2
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
        var mapView = $("#busRouteMapView").empty();

        $("#busRouteMap").unbind("pageshow").on("pageshow", function(){
            options = $.extend(
                {
                    zoom: 14,
                    center: new google.maps.LatLng(40.099, -88.226),
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                }, options),
            callback = callback || function(){};
            var map = new google.maps.Map(mapView[0], options);
            callback(map);
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
        $(".loadingImg").show();
        $.ajax({
            url: "http://developer.cumtd.com/api/v2.2/json/" + action,
            dataType: "jsonp",
            timeout: 10000,
            data: $.extend({key: KEY}, data)
        }).done(function(data){
            $(".loadingImg").hide();
            callback(data);
        }).fail(function(err){
            $(".loadingImg").hide();
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
                $("<li>").html("No bus routes currently available.").appendTo("#busArrialResults");
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
                        showGoogleMap(bus.location);
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

    $("[data-role=page]").trigger('pagecreate');
    $("[data-role=header]").fixedtoolbar({
        tapToggle: false
    });


});