/*
spreadsheet for my poker league.

We have a scoring system that works thusly:
1st = 15pts
2nd = 13pts
3rd = 11pts
4th = 9 points
5th = 7 points
6th = 5points
7th = 4 points
8th = 3 points
9th = 2 points
10th = 1 point.

If there are more than 10 players, each place gets 1 additional point per
player, so the last place finisher always receives 1 point - so with 13 players,
last place gets 1 point and first place gets 18 points.

We also have bonus points. You get 1 point if you knock out a top-three player
from the previous week. So if David won last week and I take all his chips, I
receive a bonus point.

It gets a little complicated in that these bounty chips move along to the next
player in the case of non-attendees, so if David won last week but doesn't turn
up this week, the players who finished 2nd, 3rd and 4th have this bounty on
their head.

The other bonus point is given if you finished in last place the previous week.
You handed a 'fish-chip' and if you finish in the money this week, you get a
bonus point. The money places change dependant on the amount of players; if
there's 6 players only the top two get paid, if there's 13 it's top four.

We have 12 weeks a season and only your top 9 scores count. So if you play 12
weeks your worst three scores are removed from your total.

I'd love the League table to have
  Games Played, Wins, Average Points Per Game, Bounty Points,
  Current Individual Lowest Weekly Points and Overall points.
*/

// ------------------------------------------------------------------- Utils ---

if (!Array.prototype.sum) {
  Object.defineProperty(Array.prototype, 'sum', {
    value: function() {
      if (!this.length) return 0
      return this.reduce(function(a, b) { return a + b})
    }
  })
}

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
  /**
   * Scores for each game the player has played in, 0 indicates they didn't
   * play.
   */
  this.scores = []
  /**
   * Bounty points for each game the player has played in, 0 indicates they
   * didn't play.
   */
  this.bonusPoints = []
  /**
   * Number of games won.
   */
  this.wins = 0
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

/**
 * Inserts scores for the next game, defaulting to the player not having played
 * in it.
 */
Player.prototype.nextGame = function() {
  this.scores.push(0)
  this.bonusPoints.push(0)
}

Player.prototype.resetScores = function() {
  this.scores = []
  this.bonusPoints = []
  this.wins = 0
}

/**
 * Updates the score for the current game.
 */
Player.prototype.setScore = function(score) {
  this.scores.pop()
  this.scores.push(score)
}

/**
 * Updates bonus points for the current game.
 */
Player.prototype.setBonusPoints = function(bonusPoints) {
  this.bonusPoints.pop()
  this.bonusPoints.push(bonusPoints)
}

/**
 * Registers that the player won a game.
 */
Player.prototype.win = function() {
  this.wins++
}

Player.prototype.getGameScores = function() {
  return this.scores.filter(function(score) { return score !== 0})
}

Player.prototype.getGamesPlayed = function() {
  return this.getGameScores().length
}

Player.prototype.getAveragePointsPerGame = function() {
  var scores = this.getGameScores()
  if (!scores.length) return 0
  return (scores.sum() / scores.length).toFixed(1)
}

Player.prototype.getBonusPoints = function() {
  return this.bonusPoints.sum()
}

Player.prototype.getLowestWeeklyPoints = function() {
  var scores = this.getGameScores()
  if (!scores.length) return 0
  return Math.min.apply(Math, scores)
}

Player.prototype.getOverallScore = function() {
  return this.getGameScores().slice(0)                              // Make a copy
                             .sort(function(a, b) { return b - a }) // Sort in descending order
                             .slice(0, 9)                           // Only take the top 9
                             .sum()                                 // Add 'em up
}

// -------------------------------------------------------------------- Game ---

function Game(players, knockouts) {
  /**
   * Players in the order they finished in, winner first.
   */
  this.players = players
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
}

Game.prototype.toObject = function() {
  return {
    players: this.players.map(function(p) { return p.id })
  , knockouts: this.knockouts.map(function(ko) { return [ko[0].id, ko[1].id] })
  }
}

Game.fromObject = function(players, obj) {
  return new Game(
    obj.players.map(function(id) { return players[id] }),
    obj.knockouts.map(function(ko) { return [players[ko[0]], players[ko[1]]] })
  )
}

/**
 * Sets up information based on the previous game played, for bonus calculation.
 */
Game.prototype.setPreviousGameInfo = function(previousGame) {
  // Determine who has a bounty on their head
  this.bountyPlayers = []
  for (var i = 0, l = previousGame.players.length;
       i < l && this.bountyPlayers.length < 3;
       i++) {
    var player = previousGame.players[i]
    if (this.players.indexOf(player) != -1) {
      this.bountyPlayers.push(player)
    }
  }

  // Determine who has the fish-chip
  for (var i = previousGame.players.length - 1; i >= 0; i--) {
    var player = previousGame.players[i]
    if (this.players.indexOf(player) != -1) {
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

Game.prototype.getWinner = function() {
  return this.players[0]
}

Game.prototype.getPaidPlayers = function() {
  // Determine how many players should get paid
  var playerCount = this.players.length
  var paid = (playerCount - (playerCount % 3)) / 3
  return this.players.slice(0, paid)
}

Game.prototype.calculateScores = function() {
  // Adjust points to cope with number of players if necessary
  var points = Game.DEFAULT_POINTS.slice(0)
  if (this.players.length > points.length) {
    var extraPoints = this.players.length - points.length
    // Add extra points to the defaults
    points = points.map(function(score) { return score + extraPoints})
    // Add new scores, descending, so the player in last place gets 1 point
    while (extraPoints > 0) {
      points.push(extraPoints)
      extraPoints--
    }
  }

  if (this.bountyPlayers !== null) {
    console.log('Bounties issued for: ' + this.bountyPlayers.join(', ') + '. Dead or alive!')
  }
  if (this.fishChipper !== null) {
    console.log(this.fishChipper.name + ' has the fish-chip.')
  }
  console.group('Position Scores')
  console.table([this.players.join(',').split(','), points])
  console.groupEnd()
  console.log(this.getWinner() + ' wins!')
  console.log('In the money: ' + this.getPaidPlayers().join(', '))

  for (var i = 0, l = this.players.length; i < l; i++) {
    var player = this.players[i]
      , placeScore = points[i]
      , bonusPoints = this.calculateFishChipBonus(player) + this.calculateBountyBonus(player)
    if (i == 0) {
      player.win()
    }
    player.setScore(placeScore + bonusPoints)
    player.setBonusPoints(bonusPoints)
  }
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
      console.log(player + ' gets a bonus point for cashing in with the fish-chip!')
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
        console.log(player + ' calls in the bounty on ' + knockout[1] + '!')
        bountyBonus += Game.BOUNTY_BONUS
      }
    }
  }
  return bountyBonus
}

// ------------------------------------------------------------ Calculations ---

/**
 * Calculates the score each player had in each game.
 */
function calculateScores(players, games) {
  var game
    , previousGame = null
    , bountyPlayers = null
    , fishChipper = null

  players.forEach(function(player) { player.resetScores() })
  for (var i = 0, l = games.length; i < l; i++) {
    console.group('Game #' + (i + 1))
    players.forEach(function(player) { player.nextGame() })
    game = games[i]
    if (previousGame !== null) {
      game.setPreviousGameInfo(previousGame)
    }
    game.calculateScores()
    previousGame = game
    console.groupEnd()
  }
}

// ------------------------------------------------------------------- State ---

var players = JSON.parse(localStorage.getItem('players')||'[]').map(Player.fromObject)

var games = JSON.parse(localStorage.getItem('games')||'[]').map(Game.fromObject.bind(null, players))

function savePlayers() {
  localStorage.setItem('players', JSON.stringify(players.map(function(p) { return p.toObject() })))
}

function saveGames() {
  localStorage.setItem('games', JSON.stringify(games.map(function(g) { return g.toObject() })))
}

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
  , H1('League Table')
  , TABLE({'class': 'table table-striped table-bordered table-condensed'}
    , THEAD(TR(
        TH('Name')
      , TH('Games Played')
      , TH('Wins')
      , TH('Average Points Per Game')
      , TH('Bonus Points')
      , TH('Lowest Weekly Points')
      , TH('Overall Points')
      ))
    , TBODY($for('player in players'
      , TR(
          TD(A({href: '#', click: $handler(displayPlayer, $var('player'))}, '{{player.name }}'))
        , TD('{{ player.getGamesPlayed }}')
        , TD('{{ player.wins }}')
        , TD('{{ player.getAveragePointsPerGame }}')
        , TD('{{ player.getBonusPoints }}')
        , TD('{{ player.getLowestWeeklyPoints }}')
        , TD('{{ player.getOverallScore }}')
        )
      ))
    )
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

  $template('player_details'
  , H1('{{ player.name }}')
  )

  $template('game_list'
  , H1('Games')
  , TABLE({'class': 'table table-striped table-bordered table-condensed'}
    , THEAD(TR(
        TH('#')
      , TH('Winner')
      ))
    , TBODY($for('game in games'
      , TR(
          TD(A({href: '#', click: $handler(displayGame, $var('game'))}, 'Game #{{ forloop.counter }}'))
        , TD('{{ game.getWinner.name }}')
        )
      ))
    )
  , FORM({id: 'addGameForm', 'class': 'form-horizontal', submit: $handler(addGame)}
    , FIELDSET(
        LEGEND('Add Game')
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
  , H1('Game #{{ gameNumber }}')
  )
}

// ------------------------------------------------------- Make Stuff Happen ---

function stop(e) {
  e.preventDefault()
  e.stopPropagation()
}

function displayContent(templateName, contextVariables) {
  var el = document.getElementById('contents')
  el.innerHTML = ''
  el.appendChild(template.renderTemplate(templateName, contextVariables))
}

function leagueTable(e) {
  if (e) stop(e)
  displayContent('league_table', {
    players: players.slice(0)
                    .sort(function(a, b) {
                      return b.getOverallScore() - a.getOverallScore()
                    })
  })
}

function addPlayer(e) {
  if (e) stop(e)
  var form = document.getElementById('addPlayerForm')
  if (!form.elements.name.value) return alert('Name is required to add a new player.')
  players.push(new Player(players.length, form.elements.name.value))
  savePlayers()
  calculateScores(players, games)
  leagueTable()
}

function displayPlayer(player, e) {
  if (e) stop(e)
  displayContent('player_details', {
    player: player
  })
}

function gamesList(e) {
  if (e) stop(e)
  displayContent('game_list', {
    games: games
  , players: players
  })
}

function addGame(e) {
  if (e) stop(e)
  var form = document.getElementById('addGameForm')
  // Assign players to a positions array, winner first
  var playerPositions = []
  Array.prototype.forEach.call(form.elements.position, function(el, playerIndex) {
    if (el.value != '') {
      var position = parseInt(el.value, 10)
      playerPositions[position - 1] = players[playerIndex]
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
        players[parseInt(perp, 10)]
      , players[parseInt(victim, 10)]
      ])
    }
  }

  games.push(new Game(playerPositions, knockouts))
  saveGames()
  calculateScores(players, games)
  gamesList()
}

function displayGame(game, e) {
  if (e) stop(e)
  displayContent('game_details', {
    game: game
  , gameNumber: games.indexOf(game) + 1
  })
}

// -------------------------------------------------------------------- Boot ---

document.getElementById('navLeague').onclick = leagueTable
document.getElementById('navGames').onclick = gamesList

calculateScores(players, games)
leagueTable()
