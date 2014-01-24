dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("esri.arcgis.utils");
dojo.require("esri.map");

/******************************************************
***************** begin config section ****************
*******************************************************/

var FEATURE_SERVICE_URL = "http://services.arcgis.com/nzS0F0zdNLvs7nc8/arcgis/rest/services/Nuclear_test_events_at_Yucca_Flat/FeatureServer/0";
var SINKS_SERVICE_URL = "http://tiles.arcgis.com/tiles/nzS0F0zdNLvs7nc8/arcgis/rest/services/YuccaFlat_sinks/MapServer";
var PROXY_URL = window.location.href.toLowerCase().indexOf("storymaps.esri.com") >= 0 ? "http://storymaps.esri.com/proxy/proxy.ashx" : "http://localhost/proxy/proxy.ashx";
var PERIODS_SPREADSHEET_URL = PROXY_URL+"?https://docs.google.com/spreadsheet/pub?key=0ApQt3h4b9AptdGlNUEJsZzVqODJ6OXJUUkpWQVMwOUE&output=csv";
var EVENTS_SPREADSHEET_URL = PROXY_URL+"?https://docs.google.com/spreadsheet/pub?key=0ApQt3h4b9AptdFZPZ3dySTkzVzN1MVRTVF9UWWRCbUE&output=csv";

var FIELDNAME_ID = "EsriID";
var FIELDNAME_DATE_CONVERTED_YEAR = "YearText";
var FIELDNAME_NAME = "FullName";
var FIELDNAME_YIELD = "Yield";
var FIELDNAME_DATE = "Date";
var FIELDNAME_DELIVERY = "DeliveryMethod";
var FIELDNAME_HEIGHT = "HeightAboveGround";
var FIELDNAME_OPERATION_NAME = "OperatonName";
var FIELDNAME_SHOT_NAME = "ShotName";
var FIELDNAME_PURPOSE = "Purpose";

var _fieldAliases = new Object();

_fieldAliases[FIELDNAME_DATE_CONVERTED_YEAR] = "Year"; 
_fieldAliases[FIELDNAME_NAME] = "Name";
_fieldAliases[FIELDNAME_YIELD] = "Size"; 
_fieldAliases[FIELDNAME_DATE] = "Date";
_fieldAliases[FIELDNAME_DELIVERY] = "Delivery method";
_fieldAliases[FIELDNAME_HEIGHT] = "Height";
_fieldAliases[FIELDNAME_OPERATION_NAME] = "Operation";
_fieldAliases[FIELDNAME_SHOT_NAME] = "Test shot";
_fieldAliases[FIELDNAME_PURPOSE] = "Purpose";


/******************************************************
***************** end config section ******************
*******************************************************/

var _originalHeaderHeight;
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

dojo.addOnLoad(function() {_dojoReady = true;init()});
jQuery(document).ready(function() {_jqueryReady = true;init()});

function init() {
	
	if (!_jqueryReady) return;
	if (!_dojoReady) return;
	
	_originalHeaderHeight = $("#header").height();
	
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
	
	_map.addLayer(new esri.layers.ArcGISTiledMapServiceLayer(SINKS_SERVICE_URL));
	
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
		situate();
	});
	
	$(_timeline).on("eventSelection", function(event, div, i) {
		_selectedEventIndex = i;
		var featureID = _events[i].location_id;
		if (featureID != null) {
			var arr = $.grep(_locations, function(n,i){return n.attributes[FIELDNAME_ID] == featureID});
			if (arr.length > 0) showInfoWindow(arr[0]);
		}
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

	if (!_isMobile) {
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
	}
	
	$("#tabBar .tab").click(function(e) {
        $("#tabBar .tab").removeClass("selected");
		$(this).addClass("selected");
		var index = $.inArray(e.currentTarget, $("#tabBar .tab"));
		if (index) {
			$($("#pictureFrame img")[1]).fadeOut();			
		} else {
			$($("#pictureFrame img")[1]).fadeIn();			
		}
    });
		
	handleWindowResize();

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
	$("#period-text").html("<span class='year-preface'>"+$("#year").html()+"</span>"+_periods[_timeline.getCurrentIndex()].description);
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
	var year_begin = _table[_timeline.getCurrentIndex()].year_begin;
	var year_end = _table[_timeline.getCurrentIndex()].year_end;
	$("#year").html(year_begin+" - "+year_end);		
}

function symbolize()
{

	var year_begin = _table[_timeline.getCurrentIndex()].year_begin;
	var year_end = _table[_timeline.getCurrentIndex()].year_end;
	
	_layerBottom.clear();
	_layerTop.clear();

	$.each(_locations, function(index, value) {
		if (
			(parseInt(value.attributes[FIELDNAME_DATE_CONVERTED_YEAR]) >= year_begin) && 
			(parseInt(value.attributes[FIELDNAME_DATE_CONVERTED_YEAR]) <= year_end)
			) 
		{
			value.setSymbol(createSymbol(10,[255,95,33],1,[255,255,255]));
			_layerTop.add(value);
		} else if (parseInt(value.attributes[FIELDNAME_DATE_CONVERTED_YEAR]) < year_begin) {
			value.setSymbol(createSymbol(10,[190,190,190],0.37,[225,225,225]));						
			_layerBottom.add(value);
		} else {
			//console.log("test location outside of date range");
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

	if (!_isIE) moveGraphicToFront(graphic);	

	$("#hoverInfo").html("<b>"+graphic.attributes[FIELDNAME_OPERATION_NAME]+", "+graphic.attributes[FIELDNAME_DATE_CONVERTED_YEAR]+"</b>");
	var pt = _map.toScreen(graphic.geometry);
	hoverInfoPos(pt.x,pt.y);	
	
}

function layer_onMouseOut(event) 
{
	var graphic = event.graphic;
	graphic.setSymbol(graphic.symbol.setSize(10));
	_map.setMapCursor("default");
	$("#hoverInfo").hide();	
}

function layer_onClick(event) 
{
	$("#hoverInfo").hide();
	var graphic = event.graphic;
	showInfoWindow(graphic);
}

function showInfoWindow(graphic)
{
	var table = $("<table></table>");
	var tr;
	var val;
	$.each([FIELDNAME_SHOT_NAME,FIELDNAME_DATE,FIELDNAME_YIELD,FIELDNAME_DELIVERY,FIELDNAME_PURPOSE],function(index, value){
		val = graphic.attributes[value];
		if (value == FIELDNAME_DATE) {
			val = new Date(val);
			val.setDate(val.getDate()+1)
			val = val.toLocaleDateString();
		}
		tr = $("<tr></tr>");
		$(tr).append("<td class='infowindow-content-titlename'>"+_fieldAliases[value]+"</td>")
		$(tr).append("<td class='infowindow-content-titlecontent'>"+val+"</td>");
		$(table).append(tr);
	});
	var content = $("<div></div>");
	$(content).append(table);
	_map.infoWindow.show(graphic.geometry);
	_map.infoWindow.setTitle("Operation "+graphic.attributes[FIELDNAME_OPERATION_NAME]);
	_map.infoWindow.setContent(content.html());	
}

function hoverInfoPos(x,y){
	if (x <= ($("#map").width())-230){
		$("#hoverInfo").css("left",x+15);
	}
	else{
		$("#hoverInfo").css("left",x-25-($("#hoverInfo").width()));
	}
	if (y >= ($("#hoverInfo").height())+50){
		$("#hoverInfo").css("top",y-35-($("#hoverInfo").height()));
	}
	else{
		$("#hoverInfo").css("top",y-15+($("#hoverInfo").height()));
	}
	$("#hoverInfo").show();
}

function moveGraphicToFront(graphic)
{
	var dojoShape = graphic.getDojoShape();
	if (dojoShape) dojoShape.moveToFront();
}

function handleWindowResize() {

	if (($("body").height() <= 600) || _isEmbed) {
		$("#header").height(0);
	} else {
		$("#header").height(_originalHeaderHeight);
	}

	var x = parseInt($("#info").css("padding-bottom"));
	var y = parseInt($("#info").css("padding-top"));
	$("#info").height($("#left").height() - ($("#header").height()+$("#tabBar").height()+$("#pictureFrame").height()+x+y));
	var b = $("#info hr").height() + parseInt($("#info hr").css("margin-top")) + parseInt($("#info hr").css("margin-bottom"));
	$("#period-description").height($("#info").height() - $("#intro").height() - b);
	$("#map").width($("body").width() - $("#left").width() - $("#middle").width());
	_map.resize();
	$("#timeline").height($("#middle").height() - $("#year-case").height() - 10);
	if (_timeline) _timeline.updateLayout();
	
}
