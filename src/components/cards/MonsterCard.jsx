import './MonsterCard.css'
import NagaShowcaseCard from './NagaShowcaseCard'

// Shared showcase layout; the renderer selects bespoke artwork when available.
export default function MonsterCard(props) {
  return <NagaShowcaseCard key={props.card.id} {...props} />
}
