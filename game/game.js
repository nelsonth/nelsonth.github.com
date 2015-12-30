var Game = {
    display: null,
    map: {},
    engine: null,
    player: null,
	ananas: null,
	width: 80,
	height: 30,
	statusWidth: 15,
	statusHeight: 26,
    
    init: function() {
        this.display = new ROT.Display({width:this.width, height:this.height});
        document.body.appendChild(this.display.getContainer());
        
        this._generateMap();

        
        var scheduler = new ROT.Scheduler.Simple();
        scheduler.add(this.player, true);
		scheduler.add(this.pedro, true);

		this._drawStatus();

        this.engine = new ROT.Engine(scheduler);
        this.engine.start();
    },
    
    _generateMap: function() {
        var digger = new ROT.Map.Digger(this.width, this.height-6); // taking off 6 lines for display
        var freeCells = [];
        
        var digCallback = function(x, y, value) {
            if (value) { return; }
            
            var key = x+","+y;
            this.map[key] = ".";
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        this._generateBoxes(freeCells);
        this._drawWholeMap();

		this.player = this._createBeing(Player, freeCells);
		this.pedro = this._createBeing(Pedro, freeCells);
    },

	_drawStatus: function() {
		//this.display.draw(this.statusWidth,this.statusHeight,"              ","#000","#000");
		this.display.draw(this.statusWidth,this.statusHeight,this.player._hp);
	},
    
    _generateBoxes: function(freeCells) {
        for (var i=0;i<10;i++) {
            var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
            var key = freeCells.splice(index, 1)[0];
            this.map[key] = "*";
			if (!i) {
				this.ananas = key;
			}
        }
    },
    
    _drawWholeMap: function() {
        for (var key in this.map) {
            var parts = key.split(",");
            var x = parseInt(parts[0]);
            var y = parseInt(parts[1]);
            this.display.draw(x, y, this.map[key]);
        }
    }
};

var Player = function(x, y) {
    this._x = x;
    this._y = y;
    this._draw();
	this._hp = 9;
	this._maxhp = 9;
}

Player.prototype.act = function() {
    Game.engine.lock();
    window.addEventListener("keydown", this);
}

Player.prototype.getX = function() { return this._x;}
Player.prototype.getY = function() { return this._y;}
    
Player.prototype.handleEvent = function(e) {
    var keyMap = {};
    keyMap[75] = 0; // k
    keyMap[85] = 1; // u
    keyMap[76] = 2; // l
    keyMap[78] = 3; // n
    keyMap[74] = 4; // j
    keyMap[66] = 5; // b
    keyMap[72] = 6; // h
    keyMap[89] = 7; // y

    var code = e.keyCode;
	if (code == 188) { // ,
		this._checkBox();
		return;
	}
    /* one of vi directions? */
    if (!(code in keyMap)) { return; }

    /* is there a free space? */
    var dir = ROT.DIRS[8][keyMap[code]];
    var newX = this._x + dir[0];
    var newY = this._y + dir[1];
    var newKey = newX + "," + newY;
    if (!(newKey in Game.map)) { return; }

	/* Check for Pedro */
	if (newX == Game.pedro._x && newY == Game.pedro._y) {
		Game.display.draw(Game.statusWidth, Game.statusHeight+1, "You attacked Pedro!");
	} else {
		Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y]);
		this._x = newX;
		this._y = newY;
		this._draw();
	}
    window.removeEventListener("keydown", this);
    Game.engine.unlock();
}

Player.prototype._draw = function() {
    Game.display.draw(this._x, this._y, "@", "#ff0");
}    

Player.prototype._checkBox = function() {
	var key = this._x + "," + this._y;
	if (Game.map[key] != "*") {
		alert("There is no box here yo");
	} else if (key == Game.ananas) {
		alert("You found the prize! You win!");
		Game.engine.lock();
		window.removeEventListener("keydown", this);
	} else {
		alert("This box is empty :(");
	}
}

var Pedro = function(x, y) {
	this._x = x;
	this._y = y;
	this._draw();
}

Pedro.prototype._draw = function() {
	Game.display.draw(this._x, this._y, "P", "red");
}

Pedro.prototype.act = function() {
	var x = Game.player.getX();
	var y = Game.player.getY();
	var passableCallback = function(x, y) {
		return (x+","+y in Game.map);
	}
	var astar = new ROT.Path.AStar(x, y, passableCallback, {topology:4});

	var path = [];
	var pathCallback = function(x,y) {
		path.push([x,y]);
	}
	astar.compute(this._x, this._y, pathCallback);

	path.shift(); /* remove Pedro's position from the path list */

	if (path.length == 1) {
		//Game.engine.lock();
		Game.display.draw(Game.statusWidth, Game.statusHeight+1, "Pedro attacked you!");
		Game.player._hp = Game.player._hp - 1;
		Game._drawStatus();
	} else {
		x = path[0][0];
		y = path[0][1];
		Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y]);
		this._x = x;
		this._y = y;
		this._draw();
	}
}

Game._createBeing = function(what, freeCells) {
	var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
	var key = freeCells.splice(index, 1)[0];
	var parts = key.split(",");
	var x = parseInt(parts[0]);
	var y = parseInt(parts[1]);
	return new what(x,y);
}
