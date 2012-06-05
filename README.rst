===================================
|icon| Pants McSkill's Poker League
===================================

.. |icon| image:: https://github.com/insin/poker-league/raw/master/img/icon.png

A single-page app for tracking poker league results.

   http://insin.github.com/poker-league/poker.html

Requirements & design discussion: http://www.rllmukforum.com/index.php?/topic/262021-spreadsheet-help-to-build-a-league-table

Always looking for good ideas for single-page apps in the absence of my own and
this jumped out at me, as there are a small number of entities and pages, but
a decent amount of complexity.

Implementing it in a very naive way first with very few libs (mostly just
`DOMBuilder`_ for its templating), with the aim of coming back to the completed
version and porting it to any app frameworks I want to try out, and eventually
to use it as a test case for apps which share the same codebase front and back,
and operate by progressively enhancing full versions of pages which are served
up and would otherwise work as forms 'n links webapps.

.. _`DOMBuilder`: https://github.com/insin/DOMBuilder

Current status:

* Uses ``localStorage`` to persist on every save.
* Requires a browser which supports ``classList``,
  ``firstElementChild``/``nextElementSibling`` and Array extras (i.e. get bent,
  IE).
* No back button support yet, will use History API.

"Playing Card" symbol by Jonathan C. Dietrich, from `The Noun Project`_
collection.

.. `The Noun Project`: http://www.thenounproject.com/