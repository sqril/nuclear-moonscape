dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("esri.arcgis.utils");
dojo.require("esri.map");

/******************************************************
***************** begin config section ****************
*******************************************************/

var FEATURE_SERVICE_URL = "http://services.arcgis.com/nzS0F0zdNLvs7nc8/arcgis/rest/services/YuccaFlat_deliverymethod/FeatureServer/0";
var PROXY_URL = window.location.href.toLowerCase().indexOf("storymaps.esri.com") >= 0 ? "http://storymaps.esri.com/proxy/proxy.ashx" : "http://localhost/proxy/proxy.ashx";
var PERIODS_SPREADSHEET_URL = PROXY_URL+"?https://docs.google.com/spreadsheet/pub?key=0ApQt3h4b9AptdGlNUEJsZzVqODJ6OXJUUkpWQVMwOUE&output=csv";
var EVENTS_SPREADSHEET_URL = PROXY_URL+"?https://docs.google.com/spreadsheet/pub?key=0ApQt3h4b9AptdFZPZ3dySTkzVzN1MVRTVF9UWWRCbUE&output=csv";

/******************************************************
***************** end config section ******************
*******************************************************/

var _map;

var _dojoReady = false;
var _jqueryReady = false;

var _homeExtent; // set this in init() if desired; otherwise, it will 
				 // be the default extent of the web map;

var _isMobile = isMobile();
var _isIE = (navigator.appVersion.indexOf("MSIE") > -1);
var _isEmbed = false;

var _layerBottom;
var _layerTop;

var _locations;
var _index;
var _selectedEventIndex;

var _table = [
	{year_begin:1945, year_end:1949},
	{year_begin:1950, year_end:1954},
	{year_begin:1955, year_end:1959},
	{year_begin:1960, year_end:1964},
	{year_begin:1965, year_end:1969},
	{year_begin:1970, year_end:1974},
	{year_begin:1975, year_end:1979},
	{year_begin:1980, year_end:1984},
	{year_begin:1985, year_end:1989},
	{year_begin:1990, year_end:1995}		
];

var _events;
var _periods;
var _timeline;

/*

might need this if you're using icons.

var _lutBallIconSpecs = {
	tiny:new IconSpecs(24,24,12,12),
	medium:new IconSpecs(30,30,15,15),
	large:new IconSpecs(30,30,15,15)
}
*/

dojo.addOnLoad(function() {_dojoReady = true;init()});
jQuery(document).ready(function() {_jqueryReady = true;init()});

function init() {
	
	if (!_jqueryReady) return;
	if (!_dojoReady) return;
	
	// determine whether we're in embed mode
	
	var queryString = esri.urlToObject(document.location.href).query;
	if (queryString) {
		if (queryString.embed) {
			if (queryString.embed.toUpperCase() == "TRUE") {
				_isEmbed = true;
			}
		}
	}
	
	// jQuery event assignment
	
	$(this).resize(handleWindowResize);
	
	$("#zoomIn").click(function(e) {
        _map.setLevel(_map.getLevel()+1);
    });
	$("#zoomOut").click(function(e) {
        _map.setLevel(_map.getLevel()-1);
    });
	$("#zoomExtent").click(function(e) {
        _map.setExtent(_homeExtent);
    });
	
	_map = new esri.Map("map",{slider:false,wrapAround180:false,basemap:"satellite"});

	if(_map.loaded){
		finishInit();
	} else {
		dojo.connect(_map,"onLoad",function(){
			finishInit();
		});
	}

	var servicePeriods = new CSVService();
	servicePeriods.process(PERIODS_SPREADSHEET_URL);
	$(servicePeriods).bind("complete", function(){
		var parser = new RecordParser();
		_periods = parser.getRecs(servicePeriods.getLines());
		finishInit();
	});
	
	var serviceCSV = new CSVService();
	serviceCSV.process(EVENTS_SPREADSHEET_URL);
	$(serviceCSV).bind("complete", function() {	
		var parser = new RecordParser();
		_events = parser.getRecs(serviceCSV.getLines());
		finishInit();
	});

	var query = new esri.tasks.Query();
	query.where = "1 = 1";
	query.returnGeometry = true;
	query.outFields = ["*"];

	var queryTask = new esri.tasks.QueryTask(FEATURE_SERVICE_URL);
	queryTask.execute(query, function(result){
		_locations = result.features;
		finishInit();
	});
				
}

function finishInit() {
	
	if (!(_map.loaded && _periods && _events && _locations)) return false;
	
	_layerBottom = new esri.layers.GraphicsLayer();
	_map.addLayer(_layerBottom);

	_layerTop = new esri.layers.GraphicsLayer();
	_map.addLayer(_layerTop);	
	
	dojo.connect(_layerTop, "onMouseOver", layer_onMouseOver);
	dojo.connect(_layerTop, "onMouseOut", layer_onMouseOut);
	dojo.connect(_layerTop, "onClick", layer_onClick);
	
	dojo.connect(_map, 'onClick', function(event){
		if (event.graphic == null) {
			_map.infoWindow.hide();
		}
	});	
	
	_timeline = new Timeline(
		1945,
		1995,
		5,
		_events
	);
	
	$(_timeline).on("indexChange", function() {
		_index = _timeline.getCurrentIndex();
		situate();
	});
	
	$(_timeline).on("eventSelection", function(event, div, i) {
		_selectedEventIndex = i;
		$(".qtip").remove();
		$(div).qtip({
			content:{
				text:_events[i].description,
				title:_events[i].title,
				button:false
			},
			show:{
				when: false,
				ready:true
			},
			hide:'unfocus',
			style:{
				classes: 'qtip-light qtip-rounded'
			},
			position:{
				adjust:{x:25,y:-15},
				my: 'bottom-left',
				at:'bottom-right'
			},
			events:{
				hide:function(event){_selectedEventIndex = -1;_timeline.deselectEvent();console.log(_selectedEventIndex)}
			}
		});
	});
	
	$(_timeline).on("eventHover", function(event, div, i) {
		if (i == _selectedEventIndex) return false;
		$(div).qtip({
			content:{
				text:_events[i].title
			},
			show:{
				when: false,
				ready:true
			},
			style:{
				classes: 'qtip-tipsy'
			},
			position:{
				adjust:{x:25,y:-15},
				my: 'bottom-left',
				at:'bottom-right'
			}
		});
	})
	
	handleWindowResize();

	_index = _timeline.getCurrentIndex();
	situate();
	// extent adjustment needs to be on a slight lag to give
	// browser chance to deal with initial sizing
	setTimeout(function(){
			_homeExtent = getGraphicsExtent(_locations);
			_homeExtent = _homeExtent.expand(1.2);
			_map.setExtent(_homeExtent);
		},500);
	setTimeout(function(){$("#whiteOut").fadeOut()},1000);
	
	$(document).keydown(onKeyDown);
	
}

function situate()
{
	symbolize();
	displayYears();
	$("#period-text").html("<span class='year-preface'>"+$("#year").html()+"</span>"+_periods[_index].description);
	_map.infoWindow.hide();
}

function onKeyDown(e)
{
	if ((e.keyCode != 38) && (e.keyCode != 40)) {
		return;
	}			
	if (e.keyCode == 40) 
		_timeline.stepDown() 
	else 
		_timeline.stepUp();	
}

function displayYears()
{
	var year_begin = _table[_index].year_begin;
	var year_end = _table[_index].year_end;
	$("#year").html(year_begin+" - "+year_end);		
}

function symbolize()
{

	var year_begin = _table[_index].year_begin;
	var year_end = _table[_index].year_end;
	
	_layerBottom.clear();
	_layerTop.clear();

	$.each(_locations, function(index, value) {
		if (
			(parseInt(value.attributes.Date_Converted_Year) >= year_begin) && 
			(parseInt(value.attributes.Date_Converted_Year) <= year_end)
			) 
		{
			value.setSymbol(createSymbol(10,[255,95,33],1,[255,255,255]));
			_layerTop.add(value);
		} else if (parseInt(value.attributes.Date_Converted_Year) < year_begin) {
			value.setSymbol(createSymbol(10,[190,190,190],0.37,[225,225,225]));						
			_layerBottom.add(value);
		} else {
			console.log("test location outside of date range");
		}
	});	
}

createSymbol = function(size, rgb, opacity, rgbOutline)
{
	return new esri.symbol.SimpleMarkerSymbol(
				esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, size,
				new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color(rgbOutline.concat([opacity])), 2),
				new dojo.Color(rgb.concat([opacity]))
			);	
}


function layer_onMouseOver(event) 
{
	if (_isMobile) return;
	var graphic = event.graphic;
	_map.setMapCursor("pointer");
	graphic.setSymbol(graphic.symbol.setSize(12));
	/*
	if ($.inArray(graphic, _selected) == -1) {
		graphic.setSymbol(resizeSymbol(graphic.symbol, _lutBallIconSpecs.medium));
	}
	*/
	if (!_isIE) moveGraphicToFront(graphic);	

	$(graphic.getDojoShape().getNode()).qtip({
		content:{
			text:graphic.attributes.Date_Converted_Year
		},
		show:{
			when: false,
			ready:true,
			delay:0
		},
		style:{
			classes: 'qtip-tipsy'
		},
		position:{
			adjust:{x:-5,y:-10},
			my: 'bottom-left',
			at:'bottom-right'
		}
	});
	
	
}


function layer_onMouseOut(event) 
{
	var graphic = event.graphic;
	graphic.setSymbol(graphic.symbol.setSize(10));
	_map.setMapCursor("default");
	/*
	if ($.inArray(graphic, _selected) == -1) {
		graphic.setSymbol(resizeSymbol(graphic.symbol, _lutBallIconSpecs.tiny));
	}
	*/
}


function layer_onClick(event) 
{
	$(".qtip").remove();
	var graphic = event.graphic;
	
	var table = $("<table></table>");
	var tr;
	$.each(["Yield","Date","Delivery","Height"],function(index, value){
		tr = $("<tr></tr>");
		$(tr).append("<td class='infowindow-content-titlename'>"+value+"</td>")
		$(tr).append("<td class='infowindow-content-titlecontent'>"+graphic.attributes[value]+"</td>");
		$(table).append(tr);
	});
	var content = $("<div></div>");
	$(content).append(table);
	_map.infoWindow.show(event.mapPoint);
	_map.infoWindow.setTitle(graphic.attributes.Name.substring(5));
	_map.infoWindow.setContent(content.html());
}

/*

function createIconMarker(iconPath, spec) 
{
	return new esri.symbol.PictureMarkerSymbol(iconPath, spec.getWidth(), spec.getHeight()); 
}

function resizeSymbol(symbol, spec)
{
	return symbol.setWidth(spec.getWidth()).setHeight(spec.getHeight())	
}


*/
function moveGraphicToFront(graphic)
{
	var dojoShape = graphic.getDojoShape();
	if (dojoShape) dojoShape.moveToFront();
}

function handleWindowResize() {
	/*
	if ((($("body").height() <= 500) || ($("body").width() <= 800)) || _isEmbed) $("#header").height(0);
	else $("#header").height(115);
	*/
	$("#map").width($("body").width() - $("#left").width() - $("#middle").width());
	_map.resize();
	$("#timeline").height($("#middle").height() - $("#year-case").height() - 10);
	if (_timeline) _timeline.updateLayout();
}
