var Game = {
    display: null,
    map: {},
	bots: [],
	sheduler: null,
    engine: null,
    player: null,
	width: 80,
	height: 30,
	statusWidth: 15,
	statusHeight: 26,
    
    init: function() {
        this.display = new ROT.Display({width:this.width, height:this.height});
        document.body.appendChild(this.display.getContainer());

        this.scheduler = new ROT.Scheduler.Simple();
        
        this._generateMap();

        this.scheduler.add(this.player, true);

		this._drawStatus();

        this.engine = new ROT.Engine(this.scheduler);
        this.engine.start();
    },
    
    _generateMap: function() {
		// taking off 6 lines for display
        var digger = new ROT.Map.Digger(this.width, this.height-6); 
        var freeCells = [];
        
        var digCallback = function(x, y, value) {
            if (value) { return; }
            
            var key = x+","+y;
            this.map[key] = ".";
            freeCells.push(key);
        }
        digger.create(digCallback.bind(this));
        
        // this._generateBots(freeCells);
        this._drawWholeMap();

		this.player = this._createBeing(Player, freeCells);
		for (var i=0; i<10; i++) {
			var b = this._createBeing(Lizard, freeCells);
			this.scheduler.add(b, true);
			this.bots.push(b);
		}
    },

	_drawStatus: function() {
		this.display.draw(this.statusWidth,this.statusHeight,this.player.hp);
		this.writeMessage(this.statusWidth,this.statusHeight,
				"HP: "+this.player.hp+"/" + this.player.maxhp);
	},
    
	
	/*
    _generateBots: function(freeCells) {
        for (var i=0;i<10;i++) {
            var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
            var key = freeCells.splice(index, 1)[0];
            this.map[key] = "*";
			if (!i) {
				this.ananas = key;
			}
        }
    },
	*/
    
    _drawWholeMap: function() {
        for (var key in this.map) {
            var parts = key.split(",");
            var x = parseInt(parts[0]);
            var y = parseInt(parts[1]);
            this.display.draw(x, y, this.map[key]);
        }
    },

	writeMessage: function(x,y,msg) {
		for (var i=0; i < msg.length; ++i) {
			this.display.draw(x+i,y,msg[i]);
		}
	},

	damage: function(attacker, defender, dmg) {
		this.writeMessage(this.statusWidth, this.statusHeight+1,
			attacker.name + " dealt " + dmg + " damage to " + defender.name + ".");
		defender.hp = defender.hp - dmg;
		if (defender.hp <= 0) {
			defender.die();
		}
	}
};

var Player = function(x, y) {
    this._x = x;
    this._y = y;
    this._draw();
	this.hp = 9;
	this.maxhp = 9;
	this.name = "You";
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
	/*
	if (code == 188) { // ,
		this._checkBox();
		return;
	}
	*/
    /* one of vi directions? */
    if (!(code in keyMap)) { return; }

    /* is there a free space? */
    var dir = ROT.DIRS[8][keyMap[code]];
    var newX = this._x + dir[0];
    var newY = this._y + dir[1];
    var newKey = newX + "," + newY;
    if (!(newKey in Game.map)) { return; }

	/* Check for bots */
	var attack = false;
	for (var i=0; i < Game.bots.length; ++i) {
		var bot = Game.bots[i];
		if (newX == bot._x && newY == bot._y) {
			Game.damage(this, bot, 1);
			attack = true;
		}
	} 
	if (!attack) {
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

/*
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
*/

Player.prototype.die = function() {
	/* Player dies, game is over */
	alert("You have died.  Game over.");
	Game.engine.lock();
	window.removeEventListener("keydown", this);
}

var Lizard = function(x, y) {
	this._x = x;
	this._y = y;
	this.hp = 3;
	this.maxhp = 3;
	this._draw();
	this.name = "Lizard";
}

Lizard.prototype._draw = function() {
	Game.display.draw(this._x, this._y, "l", "cyan");
}

Lizard.prototype.act = function() {
	var x = Game.player.getX();
	var y = Game.player.getY();
	var passableCallback = function(x, y) {
		return (x+","+y in Game.map);
	}
	var astar = new ROT.Path.AStar(x, y, passableCallback, {topology:8});

	var path = [];
	var pathCallback = function(x,y) {
		path.push([x,y]);
	}
	astar.compute(this._x, this._y, pathCallback);

	path.shift(); /* remove lizard's position from the path list */

	if (path.length == 1) {
		Game.damage(this, Game.player, 1);
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

Lizard.prototype.die = function() {
	/* remove from map, remove from scheduler */
	Game.writeMessage(Game.statusWidth, Game.statusHeight+1,
			"You killed the Lizard!");
	var success = Game.scheduler.remove(this);
	// console.log("removed lizard: " + success);
	Game.display.draw(this._x, this._y, Game.map[this._x+","+this._y]);
	/* remove lizard from bot list */
	Game.bots.splice(Game.bots.indexOf(this),1);
}

Game._createBeing = function(what, freeCells) {
	var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
	var key = freeCells.splice(index, 1)[0];
	var parts = key.split(",");
	var x = parseInt(parts[0]);
	var y = parseInt(parts[1]);
	return new what(x,y);
}
