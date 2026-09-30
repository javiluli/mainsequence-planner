import { maxBuriedCells } from '../lib/underground'
import type { RoutePlacementIssue } from '../lib/world-layout'
import type { RouteTool } from '../model/catalog'

/** Each rejection names the cause and the next useful edit, without changing the draft. */
export function routeIssueMessage(issue: RoutePlacementIssue, type: RouteTool): string {
  switch (issue) {
    case 'empty':
      return 'Start the belt on buildable floor or at an output port.'
    case 'tunnel-too-short':
      return 'An underground belt needs an entrance, at least one buried cell, and an exit.'
    case 'tunnel-too-long':
      return `This underground belt can span at most ${maxBuriedCells(type)} buried cells. Choose a closer exit.`
    case 'tunnel-direction':
      return 'Underground belts must run straight without turns. Move the anchor into line.'
    case 'direction':
      return 'The belt cannot reverse through this cell. Move the anchor or approach the port from another side.'
    case 'outside-floor':
      return 'There is no connected floor here. Align station doorways or stay within a station.'
    case 'occupied':
      return 'Another part occupies this cell. Route the belt around it.'
    case 'belt-tier':
      return 'This cell has a different belt tier. Connect Mk1 to Mk1 or Mk2 to Mk2.'
    case 'wall':
      return 'A wall blocks this segment. Route through aligned station doorways.'
  }
}
