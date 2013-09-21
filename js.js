$(function(){

    if(location.hash != "" && location.hash != "#busArrival"){
        $.mobile.changePage("#busArrival");
    }

    Number.prototype.addZero = function(){
    	return (this < 10 ? "0" : "") + this;
    };

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
                    availableDirections = {}; //Store a list of directions
                $(data.departures).each(function(){
                    console.log(this);
                    var expMin = this.expected_mins,
                        expTime = new Date(this.expected),
                        routeName = this.headsign,
                        entry = $("<li>")
                            .appendTo("#busArrialResults")
                            .data("stop_id", this.stop_id)
                            .data("direction", this.trip.direction),
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
                    availableDirections[this.trip.direction] = true;
                });

                //Create <select> to filter stops
                availablePlatforms = Object.keys(availablePlatforms).sort();
                availableDirections = Object.keys(availableDirections).sort();

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
                    directions = $("<optgroup>").attr("label", "Directions").appendTo(select);
                $(availablePlatforms).each(function(){
                    $("<option>")
                        .html(getStopDetails(this).stop_name)
                        .data("filter", {
                            type: "platforms",
                            value: this
                        })
                        .appendTo(platforms);
                })
                $(availableDirections).each(function(){
                    $("<option>")
                        .html(this)
                        .data("filter", {
                            type: "direction",
                            value: this
                        })
                        .appendTo(directions);
                })

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
          window.open("https://www.google.com/maps?q=(" + location.lat + "%2C" + location.lon + ")", "_system");
    }

    $("[data-role=page]").trigger('pagecreate');
    $("[data-role=header]").fixedtoolbar({
        tapToggle: false
    });


});