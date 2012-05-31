// =================================================================== Utils ===

if (!Array.prototype.sum) {
  Object.defineProperty(Array.prototype, 'sum', {
    value: function() {
      return this.reduce(function(a, b) { return a + b}, 0)
    }
  })
}

// ================================================================ Entities ===

// ------------------------------------------------------------------ Player ---

function Player(id, name) {
  /**
   * Unique id for the player.
   */
  this.id = id
  /**
   * The player's name.
   */
  this.name = name
}

Player.prototype.toString = function() {
  return this.name
}

Player.prototype.toObject = function() {
  return {id: this.id, name: this.name}
}

Player.fromObject = function(obj) {
  return new Player(obj.id, obj.name)
}

// ------------------------------------------------------------------- Score ---

/**
 * Scoring for a Player in a sequence of games.
 */
function Score(player) {
  /**
   * The player this score is for.
   */
  this.player = player
  /**
   * Scores for each game the player has played in, by game index.
   */
  this.scores = []
  /**
   * Bounty points for each game the player has played in, by game index.
   */
  this.bonusPoints = []
  /**
   * Number of games won by the player.
   */
  this.wins = 0
}

/**
 * Gets a Score object for the given player, or creates and adds one.
 */
Score.getOrCreate = function(player, scores) {
  // Look for an existing Score
  for (var i = 0, l = scores.length; i < l; i++) {
    if (player === scores[i].player) {
      return scores[i]
    }
  }
  // Otherwise, create and add a new Score
  var score = new Score(player)
  scores.push(score)
  return score
}

Score.prototype.reset = function() {
  this.scores = []
  this.bonusPoints = []
  this.wins = 0
}

/**
 * Registers the score for the given game.
 */
Score.prototype.setScore = function(game, score) {
  this.scores[game.index] = score
}

/**
 * Registers bonus points earned for the given game.
 */
Score.prototype.setBonusPoints = function(game, bonusPoints) {
  this.bonusPoints[game.index] = bonusPoints
}

/**
 * Registers that the player won a game.
 */
Score.prototype.win = function() {
  this.wins++
}

/**
 * Fiters undefined values out of the scores array, which is sparse.
 */
Score.prototype.getGameScores = function() {
  return this.scores.filter(function(s) { return typeof s != 'undefined'})
}

Score.prototype.getGamesPlayed = function() {
  return this.getGameScores().length
}

Score.prototype.getAveragePointsPerGame = function() {
  var scores = this.getGameScores()
  if (!scores.length) return 0
  return (scores.sum() / scores.length).toFixed(1)
}

Score.prototype.getBonusPoints = function() {
  return this.bonusPoints.sum()
}

Score.prototype.getLowestWeeklyPoints = function() {
  var scores = this.getGameScores()
  if (!scores.length) return 0
  return Math.min.apply(Math, scores)
}

Score.prototype.getOverallScore = function() {
  return this.getGameScores().slice(0)                              // Make a copy
                             .sort(function(a, b) { return b - a }) // Sort in descending order
                             .slice(0, 9)                           // Only take the top 9
                             .sum()                                 // Add 'em up
}

// ------------------------------------------------------------------ Season ---

/**
 * A 12 week season of poker games.
 */
function Season(name) {
  /**
   * Whimsy, the obvious, whatever you like.
   */
  this.name = name
  /**
   * Games played in this season.
   */
  this.games = []
  /**
   * Scores for players who've played in this season.
   */
  this.scores = []
}

Season.prototype.toObject = function() {
  return {
    name: this.name
  , games: this.games.map(function(g) { return g.toObject() })
  }
}

Season.fromObject = function(obj) {
  var season = new Season(obj.name)
  obj.games.forEach(function(gameObj) {
    season.addGame(Game.fromObject(gameObj), false)
  })
  season.sortScores
  return season
}

/**
 * Adds a game and calculates its scores.
 */
Season.prototype.addGame = function(game, sortScores) {
  // If this is not the first game, let it know about the previous game
  if (this.games.length) {
    game.setPreviousGameInfo(this.games[this.games.length - 1])
  }
  // Let the game know which index it's going to live at
  game.index = this.games.length
  // Link back to this season
  game.season = this
  this.games.push(game)
  game.calculateScores(this.scores)
  if (!sortScores) {
    this.sortScores()
  }
}

/**
 * Sorts scores based on overall score.
 */
Season.prototype.sortScores = function() {
  this.scores.sort(function(a, b) {
    return b.getOverallScore() - a.getOverallScore()
  })
}

// -------------------------------------------------------------------- Game ---

function Game(date, results, knockouts) {
  /**
   * The season this game belongs to.
   */
  this.season = null
  /**
   * Index of this game in its Season's games.
   */
  this.index = null
  /**
   * Date the game was played on.
   */
  this.date = date
  /**
   * Players in the order they finished in, winner first.
   */
  this.results = results
  /**
   * Record who knocked out who, [perp, victim], for distribution of bonus
   * points.
   */
  this.knockouts = knockouts || []
  /**
   * Top 3 players from last game who are playing this game.
   */
  this.bountyPlayers = null
  /**
   * Lowest-placed player from last game who is playing this game.
   */
  this.fishChipper = null
  /**
   * The story of the game, as told by scoring log messages.
   */
  this.story = []
}

Game.prototype.toObject = function() {
  return {
    date: [this.date.getFullYear(),
           this.date.getMonth() + 1,
           this.date.getDate()].join('-')
  , results: this.results.map(function(p) { return p.id })
  , knockouts: this.knockouts.map(function(ko) { return [ko[0].id, ko[1].id] })
  }
}

Game.fromObject = function(obj) {
  var dateParts = obj.date.split('-').map(Number)
  return new Game(
    new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
  , obj.results.map(function(id) { return Players.get(id) })
  , obj.knockouts.map(function(ko) {
      return [Players.get(ko[0]), Players.get(ko[1])]
    })
  )
}

/**
 * Sets up information based on the previous game played, for bonus calculation.
 */
Game.prototype.setPreviousGameInfo = function(previousGame) {
  // Determine who has a bounty on their head
  this.bountyPlayers = []
  for (var i = 0, l = previousGame.results.length;
       i < l && this.bountyPlayers.length < 3;
       i++) {
    var player = previousGame.results[i]
    if (this.results.indexOf(player) != -1) {
      this.bountyPlayers.push(player)
    }
  }

  // Determine who has the fish-chip
  for (var i = previousGame.results.length - 1; i >= 0; i--) {
    var player = previousGame.results[i]
    if (this.results.indexOf(player) != -1) {
      this.fishChipper = player
      break
    }
  }
}

/**
 * Default distribution of points based on finishing position, winner first.
 */
Game.DEFAULT_POINTS = [15, 13, 11, 9, 7, 5, 4, 3, 2, 1]

/**
 * Bonus points awarded for having the fish-chip and being in the money.
 */
Game.FISH_CHIP_BONUS = 1

/**
 * Bonus points awarded for knocking out a top 3 player from the previous game.
 */
Game.BOUNTY_BONUS = 1

Game.prototype.getGameNumber = function() {
  return this.index + 1
}

Game.prototype.getWinner = function() {
  return this.results[0]
}

Game.prototype.getPaidPlayers = function() {
  // Determine how many players should get paid
  var playerCount = this.results.length
  var paid = (playerCount - (playerCount % 3)) / 3
  return this.results.slice(0, paid)
}

Game.prototype.calculateScores = function(scores) {
  this.story = []

  // Adjust points to cope with number of players if necessary
  var points = Game.DEFAULT_POINTS.slice(0)
  if (this.results.length > points.length) {
    var extraPoints = this.results.length - points.length
    // Add extra points to the defaults
    points = points.map(function(score) { return score + extraPoints})
    // Add new points, descending, so the player in last place gets 1 point
    while (extraPoints > 0) {
      points.push(extraPoints)
      extraPoints--
    }
  }

  if (this.bountyPlayers !== null) {
    this.log('Bounties issued for: ' + this.bountyPlayers.join(', ') + '.')
  }
  if (this.fishChipper !== null) {
    this.log(this.fishChipper.name + ' has the fish-chip.')
  }

  for (var i = 0, l = this.results.length; i < l; i++) {
    var player = this.results[i]
      , score = Score.getOrCreate(player, scores)
      , placeScore = points[i]
      , bonusPoints = this.calculateFishChipBonus(player) + this.calculateBountyBonus(player)
    if (i == 0) {
      score.win()
    }
    score.setScore(this, placeScore + bonusPoints)
    score.setBonusPoints(this, bonusPoints)
  }

  for (var i = 0, l = this.knockouts.length; i < l; i++) {
    var ko = this.knockouts[i]
    this.log(ko[0].name + ' knocked out ' + ko[1].name)
  }

  this.log(this.getWinner() + ' wins!')
  this.log('In the money: ' + this.getPaidPlayers().join(', '))
}

/**
 * Calculates bonus points based on the given player ending up in the money
 * after losing the previous game.
 */
Game.prototype.calculateFishChipBonus = function(player) {
  var fishChipBonus = 0
  if (player === this.fishChipper) {
    var paidPlayers = this.getPaidPlayers()
    if (paidPlayers.indexOf(player) != -1) {
      this.log(player + ' gets a bonus point for cashing in with the fish-chip!')
      fishChipBonus += Game.FISH_CHIP_BONUS
    }
  }
  return fishChipBonus
}

/**
 * Calculates bonus points based on the given player having knocked out a
 * bounty player.
 */
Game.prototype.calculateBountyBonus = function(player) {
  var bountyBonus = 0
  if (this.bountyPlayers !== null) {
    for (var i = 0, l = this.knockouts.length; i < l; i++) {
      var knockout = this.knockouts[i]
      if (knockout[0] === player && this.bountyPlayers.indexOf(knockout[1]) != -1) {
        this.log(player + ' calls in the bounty on ' + knockout[1] + '!')
        bountyBonus += Game.BOUNTY_BONUS
      }
    }
  }
  return bountyBonus
}

Game.prototype.log = function(message) {
  this.story.push(message)
}

// ----------------------------------------------------------------- Storage ---

/**
 * Wrapper around localStorage which stores instances in an array, using its
 * indices as ids.
 */
var LocalStorage = Concur.extend({
  constructor: function(entity, storageKey) {
    if (typeof entity.fromObject != 'function') {
      throw new Error(storageKey + ': LocalStorage entities must define a static fromObject() function.')
    }
    if (typeof entity.prototype.toObject != 'function') {
      throw new Error(storageKey + ': LocalStorage entities must define a toObject() instance method.')
    }
    this._entity = entity
    this._storageKey = storageKey
    /**
     * Working copy of stored data, null indicates that it hasn't been
     * initialised from localStorage yet.
     */
    this._store = null
  }

  /**
   * Loads JSON from localStorage and uses the entity's fromObject() to
   * initialise the storage array.
   */
, _load: function() {
    var json = localStorage.getItem(this._storageKey)
    // If this is the first load, there won't be any data
    this._store = json ? JSON.parse(json).map(this._entity.fromObject) : []
  }

  /**
   * Saves the current working copy to localStorage using the entity's
   * toObject() method to create plain data representations to be stringified.
   */
, _save: function() {
    var json = JSON.stringify(this._store.map(
      function(instance) { return instance.toObject() }
    ))
    localStorage.setItem(this._storageKey, json)
  }

  /**
   * Gets the storage array for the entity, initialising it first if necessary.
   */
, _getStore: function() {
    if (this._store === null) {
      this._load()
    }
    return this._store
  }

  /**
   * Gets all instances of the entity - altering the array won't affect the
   * working copy, but altering an instance will.
   */
, all: function() {
    return this._getStore().slice(0)
  }

  /**
   * Gets the instances with the given id.
   */
, get: function(id) {
    return this._getStore()[id]
  }

  /**
   * Determines the next available id (working copy array index).
   */
, nextId: function() {
    return this._getStore().length
  }

  /**
   * Generates an id for the given instance and stores it.
   */
, add: function(instance) {
    instance.id = this.nextId()
    this._getStore().push(instance)
    this._save()
    return instance
  }

  /**
   * Saves an existing instance - in practice this means writing the job lot to
   * localStorage, but that's just this crappy implmentation.
   */
, save: function(instance) {
    this._save()
  }
})

var Players = new LocalStorage(Player, 'players')
var Seasons = new LocalStorage(Season, 'seasons')

// ====================================================================== UI ===

// --------------------------------------------------------------- Templates ---

var templateAPI = DOMBuilder.modes.template.api

var EventHandlerNode = templateAPI.TemplateNode.extend({
  constructor: function(func, args) {
    args = args || []
    this.func = func
    this.args = []
    for (var i = 0, l = args.length; i < l; i++) {
      if (args[i] instanceof templateAPI.Variable) {
        this.args.push(args[i])
      }
      else {
        this.args.push(new templateAPI.TextNode(args[i]))
      }
    }
  }

  /**
   * Looks up arguments values from the template context and returns a function
   * which will call the handler with the configured arguments and any arguments
   * passed to the event handling function.
   */
, render: function(context) {
    var func = this.func, args = []
    for (var i = 0, l = this.args.length; i < l; i++) {
      if (this.args[i] instanceof templateAPI.Variable) {
        args.push(this.args[i].resolve(context))
      }
      else {
        args.push(this.args[i].render(context).join(''))
      }

    }
    return function() {
      this.func.apply(this, args.concat(Array.prototype.slice.call(arguments, 0)))
    }.bind(this)
  }
})

/**
 * Provides access to construct an EventHandlerNode in templates.
 */
DOMBuilder.template.$handler = function(func) {
  return new EventHandlerNode(func, Array.prototype.slice.call(arguments, 1))
}

var template = DOMBuilder.template
with (template) {
  $template('league_table'
  , TABLE({'class': 'table table-striped table-bordered table-condensed'}
    , THEAD(TR(
        TH('Player')
      , TH('Games Played')
      , TH('Wins')
      , TH('Average Points Per Game')
      , TH('Bonus Points')
      , TH('Lowest Weekly Points')
      , TH('Overall Points')
      ))
    , TBODY($for('score in scores'
      , TR(
          TD(
            A({href: '#', click: $handler(displayPlayer, $var('score.player'))}
            , '{{ score.player.name }}'
            )
          )
        , TD('{{ score.getGamesPlayed }}')
        , TD('{{ score.wins }}')
        , TD('{{ score.getAveragePointsPerGame }}')
        , TD('{{ score.getBonusPoints }}')
        , TD('{{ score.getLowestWeeklyPoints }}')
        , TD('{{ score.getOverallScore }}')
        )
      ))
    )
  )

  $template('index'
  , $if('season'
    , H1(
        A({href: '#', click: $handler(displaySeason, $var('season'))}, '{{ season.name }}')
      , ' League Table'
      )
    , $include('league_table', {scores: $var('season.scores')})
    , $else(
        P('There are no Seasons set up yet.')
      )
    )
  )

  $template('player_list'
  , H1('Players')
  , UL($for('player in players'
    , LI(A({href: '#', click: $handler(displayPlayer, $var('player'))}, '{{ player.name }}'))
    ))
  , FORM({id: 'addPlayerForm', 'class': 'form-horizontal', submit: $handler(addPlayer)}
    , FIELDSET(
        LEGEND('Add Player')
      , DIV({'class': 'control-group'}
        , LABEL({'class': 'control-label', 'for': 'name'}, 'Name')
        , DIV({'class': 'controls'}
          , INPUT({'class:': 'input-large', type: 'text', name: 'name', id: 'name'})
          )
        )
      , DIV({'class': 'form-actions'}
        , BUTTON({'class': 'btn btn-primary', type: 'submit'}, 'Add Player')
        )
      )
    )
  )

  // TODO
  $template('player_details'
  , H1('Player: {{ player.name }}')
  )

  $template('season_list'
  , H1('Seasons')
  , TABLE({'class': 'table table-striped table-bordered table-condensed'}
    , THEAD(TR(
        TH('Name')
      , TH('# Games Played')
      ))
    , TBODY($for('season in seasons'
      , TR(
          TD(
            A({href: '#', click: $handler(displaySeason, $var('season'))}
            , '{{ season.name }}'
            )
          )
        , TD('{{ season.games.length }}')
        )
      ))
    )
  , FORM({id: 'addSeasonForm', 'class': 'form-horizontal', submit: $handler(addSeason)}
    , FIELDSET(
        LEGEND('Add Season')
      , DIV({'class': 'control-group'}
        , LABEL({'class': 'control-label', 'for': 'name'}, 'Name')
        , DIV({'class': 'controls'}
          , INPUT({'class:': 'input-large', type: 'text', name: 'name', id: 'name'})
          )
        )
      , DIV({'class': 'form-actions'}
        , BUTTON({'class': 'btn btn-primary', type: 'submit'}, 'Add Season')
        )
      )
    )
  )

  $template('season_details'
  , H1('Season: {{ season.name }}')
  , H2('League Table')
  , $include('league_table', {scores: $var('season.scores')})
  , H2('Games')
  , TABLE({'class': 'table table-striped table-bordered table-condensed'}
    , THEAD(TR(
        TH()
      , TH('Players')
      , TH('Played On')
      , TH('Winner')
      ))
    , TBODY($for('game in season.games'
      , TR(
          TD(A({href: '#', click: $handler(displayGame, $var('game'))}, 'Game {{ game.getGameNumber }}'))
        , TD('{{ game.results.length }}')
        , TD('{{ game.date.toDateString }}')
        , TD(A({href: '#', click: $handler(displayPlayer, $var('game.getWinner'))}, '{{ game.getWinner.name }}'))
        )
      ))
    )
  , FORM({id: 'addGameForm', 'class': 'form-horizontal', submit: $handler(addGame, $var('season'))}
    , FIELDSET(
        LEGEND('Add Game')
      , DIV({'class': 'control-group'}
        , LABEL({'class': 'control-label', 'for': 'date'}, 'Date')
        , DIV({'class': 'controls'}
          , INPUT({type: 'text', name: 'date', id: 'date'})
          , SPAN({'class': 'help-inline'}, 'DD/MM/YYYY')
          )
        )
      , DIV({'class': 'control-group'}
        , LABEL({'class': 'control-label'}, 'Results')
        , DIV({'class': 'controls'}
          , TABLE({'class': 'table table-condensed'}
            , THEAD(TR(
                TH('Player')
              , TH('Position')
              ))
            , TBODY($for('player in players'
              , TR(
                  TD('{{ player.name }}')
                , TD(INPUT({type: 'text', name: 'position', 'class': 'input-mini'}))
                )
              ))
            )
          )
        )
      , DIV({'class': 'control-group'}
        , LABEL({'class': 'control-label'}, 'Knockouts')
        , DIV({'class': 'controls'}
          , DIV(
              SELECT({'name': 'perp'}
              , OPTION({value: ''}, '----')
              , $for('player in players'
                , OPTION({value: '{{ player.id }}'}, '{{ player.name }}')
                )
              )
            , ' knocked out '
            , SELECT({'name': 'victim'}
              , OPTION({value: ''}, '----')
              , $for('player in players'
                , OPTION({value: '{{ player.id }}'}, '{{ player.name }}')
                )
              )
            )
          , BUTTON({'class': 'btn btn-success', type: 'button', click: function(e) {
              var ko = this.parentNode.firstChild.cloneNode(true)
              var el = DOMBuilder.dom
              ko.appendChild(
                 el.BUTTON({'class': 'btn btn-danger', type: 'button', click: function(e) {
                  this.parentNode.parentNode.removeChild(this.parentNode)
                 }}, el.I({'class': 'icon-minus'}))
              )
              this.parentNode.insertBefore(ko, this)
            }}, I({'class': 'icon-plus'}))
          )
        )
      , DIV({'class': 'form-actions'}
        , BUTTON({'class': 'btn btn-primary', type: 'submit'}, 'Add Game')
        )
      )
    )
  )

  $template('game_details'
  , H1(
      'Game {{ game.getGameNumber }} in '
    , A({href: '#', click: $handler(displaySeason, $var('game.season'))}, '{{ game.season.name }}')
    , ', played on {{ game.date.toDateString }}'
    )
  , H2('Story of the Game')
  , $for('line in game.story'
    , P('{{ line }}')
    )
  )
}

// ------------------------------------------------------------------- Views ---

function stop(e) {
  e.preventDefault()
  e.stopPropagation()
}

function displayContent(templateName, contextVariables) {
  var el = document.getElementById('contents')
  el.innerHTML = ''
  el.appendChild(template.renderTemplate(templateName, contextVariables))
}

function index(e) {
  if (e) stop(e)
  displayContent('index', {
    season: Seasons.all().pop()
  })
}

function playersList(e) {
  if (e) stop(e)
  displayContent('player_list', {
    players: Players.all()
  })
}

function addPlayer(e) {
  if (e) stop(e)
  var form = document.getElementById('addPlayerForm')
  if (!form.elements.name.value) return alert('Name is required to add a new Player.')
  var player = Players.add(new Player(players.length, form.elements.name.value))
  playersList()
}

function displayPlayer(player, e) {
  if (e) stop(e)
  displayContent('player_details', {
    player: player
  })
}

function seasonsList(e) {
  if (e) stop(e)
  displayContent('season_list', {
    seasons: Seasons.all()
  })
}

function addSeason(e) {
  if (e) stop(e)
  var form = document.getElementById('addSeasonForm')
  if (!form.elements.name.value) return alert('Name is required to add a new Season.')
  var season = Seasons.add(new Season(form.elements.name.value))
  displaySeason(season)
}

function displaySeason(season, e) {
  if (e) stop(e)
  displayContent('season_details', {
    season: season
  , players: Players.all()
  })
}

function addGame(season, e) {
  if (e) stop(e)
  var form = document.getElementById('addGameForm')
  var dateParts = form.elements.date.value.split('/').map(Number)
    , date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0])
  // Assign players to a positions array, winner first
  var playerPositions = []
  Array.prototype.forEach.call(form.elements.position, function(el, playerIndex) {
    if (el.value != '') {
      var position = parseInt(el.value, 10)
      playerPositions[position - 1] = Players.get(playerIndex)
    }
  })
  // Set up record of important knockouts
  var knockouts = []
    , perps = form.elements.perp
    , victims = form.elements.victim
  if (typeof perps.length == 'undefined') {
    perps = [perps]
    victims = [victims]
  }
  for (var i = 0, l = perps.length; i < l; i++) {
    var perp = perps[i].value
      , victim = victims[i].value
    if (perp != '' && victim != '' && perp != victim) {
      knockouts.push([
        Players.get(parseInt(perp, 10))
      , Players.get(parseInt(victim, 10))
      ])
    }
  }
  // Add the game to its season
  season.addGame(new Game(date, playerPositions, knockouts))
  Seasons.save(season)
  displaySeason(season)
}

function displayGame(game, e) {
  if (e) stop(e)
  displayContent('game_details', {
    game: game
  })
}

// ==================================================================== Init ===

document.getElementById('navIndex').onclick = index
document.getElementById('navSeasons').onclick = seasonsList
document.getElementById('navPlayers').onclick = playersList

index()
