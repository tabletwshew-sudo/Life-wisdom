/**
 * A built-in list of family-friendly ideas for the "Suggest something" button.
 * No AI service needed (so no cost). Each has a starter ingredient list so it
 * can be saved as a recipe or idea in one tap.
 */
export interface Suggestion {
  title: string
  emoji: string
  kind: 'food' | 'drink'
  tags: string[]
  ingredients: string[]
}

const S = (title: string, emoji: string, tags: string[], ingredients: string[], kind: 'food' | 'drink' = 'food'): Suggestion => ({
  title,
  emoji,
  kind,
  tags,
  ingredients,
})

export const SUGGESTIONS: Suggestion[] = [
  S('Spaghetti bolognese', '🍝', ['dinner', 'kid-friendly'], ['500g beef mince', '1 onion', '2 cloves garlic', '2 tins chopped tomatoes', '400g spaghetti']),
  S('Homemade pizza night', '🍕', ['dinner', 'kid-friendly', 'vegetarian'], ['500g bread flour', '7g yeast', '1 jar passata', '250g mozzarella']),
  S('Fish finger sandwiches', '🐟', ['dinner', 'kid-friendly'], ['12 fish fingers', '1 loaf bread', 'Lettuce', 'Ketchup']),
  S('Chicken fajitas', '🌯', ['dinner', 'kid-friendly'], ['3 chicken breasts', '2 peppers', '1 onion', '8 tortilla wraps', '1 pack fajita spice', '150g soured cream']),
  S('Veggie chilli', '🌶️', ['dinner', 'vegetarian'], ['2 tins kidney beans', '1 tin black beans', '2 tins chopped tomatoes', '1 onion', '2 peppers', '250g rice']),
  S('Roast chicken dinner', '🍗', ['dinner'], ['1 whole chicken', '1kg potatoes', '4 carrots', '1 head broccoli', 'Gravy granules']),
  S('Jacket potatoes', '🥔', ['dinner', 'lunch', 'kid-friendly', 'vegetarian'], ['4 baking potatoes', '1 tin baked beans', '150g cheddar']),
  S('Chicken curry', '🍛', ['dinner'], ['4 chicken thighs', '1 onion', '1 jar curry sauce', '250g rice', '4 naan breads']),
  S('Cottage pie', '🥧', ['dinner', 'kid-friendly'], ['500g beef mince', '1 onion', '2 carrots', '1kg potatoes', '50g butter', '100ml milk']),
  S('Salmon, rice & greens', '🍣', ['dinner'], ['4 salmon fillets', '250g rice', '200g green beans', '1 lemon', 'Soy sauce']),
  S('Pasta pesto with peas', '🌿', ['dinner', 'lunch', 'kid-friendly', 'vegetarian'], ['400g pasta', '1 jar pesto', '200g frozen peas', 'Parmesan']),
  S('Sausage & mash', '🌭', ['dinner', 'kid-friendly'], ['8 sausages', '1kg potatoes', '50g butter', '1 tin baked beans']),
  S('Stir-fry noodles', '🥢', ['dinner', 'vegetarian'], ['300g noodles', '1 pack stir-fry veg', 'Soy sauce', '1 thumb ginger']),
  S('Tacos', '🌮', ['dinner', 'kid-friendly'], ['500g beef mince', '8 taco shells', '1 pack taco seasoning', 'Lettuce', '150g cheddar', '2 tomatoes']),
  S('Tomato soup & cheese toasties', '🥫', ['lunch', 'kid-friendly', 'vegetarian'], ['2 tins tomato soup', '1 loaf bread', '200g cheddar']),
  S('Pancakes', '🥞', ['breakfast', 'dessert', 'kid-friendly', 'vegetarian'], ['100g plain flour', '2 eggs', '300ml milk', '1 lemon', 'Sugar']),
  S('Porridge with berries', '🥣', ['breakfast', 'vegetarian'], ['200g oats', '500ml milk', '150g berries', 'Honey']),
  S('Scrambled eggs on toast', '🍳', ['breakfast', 'vegetarian'], ['6 eggs', '1 loaf bread', '25g butter']),
  S('Overnight oats', '🫙', ['breakfast', 'vegetarian'], ['200g oats', '300g yoghurt', '200ml milk', '2 bananas']),
  S('Wraps & dips picnic', '🧺', ['lunch', 'kid-friendly'], ['6 wraps', '1 tub hummus', '2 carrots', '1 cucumber', '200g ham']),
  S('Chicken Caesar salad', '🥗', ['lunch', 'dinner'], ['2 chicken breasts', '1 romaine lettuce', 'Croutons', 'Parmesan', 'Caesar dressing']),
  S('Mac & cheese', '🧀', ['dinner', 'kid-friendly', 'vegetarian'], ['350g macaroni', '50g butter', '50g plain flour', '600ml milk', '200g cheddar']),
  S('Lentil dahl', '🫘', ['dinner', 'vegetarian'], ['250g red lentils', '1 tin coconut milk', '1 onion', '2 cloves garlic', '2 tsp curry powder', '250g rice']),
  S('Burgers & wedges', '🍔', ['dinner', 'kid-friendly'], ['4 burgers', '4 burger buns', '1kg potatoes', 'Lettuce', '4 cheese slices']),
  S('Apple crumble', '🍏', ['dessert', 'vegetarian'], ['6 apples', '150g plain flour', '100g butter', '100g sugar', 'Custard']),
  S('Chocolate brownies', '🍫', ['dessert', 'vegetarian', 'kid-friendly'], ['200g dark chocolate', '175g butter', '3 eggs', '250g sugar', '75g plain flour']),
  S('Fruit salad', '🍓', ['dessert', 'vegetarian', 'kid-friendly'], ['2 bananas', '1 pineapple', '200g grapes', '200g strawberries']),
  S('Banana bread', '🍌', ['dessert', 'breakfast', 'vegetarian'], ['3 bananas', '75g butter', '150g sugar', '1 egg', '190g plain flour']),
  // Drinks
  S('Strawberry banana smoothie', '🍓', ['drink', 'smoothie', 'kid-friendly'], ['200g strawberries', '1 banana', '200ml milk', '100g yoghurt'], 'drink'),
  S('Green smoothie', '🥬', ['drink', 'smoothie'], ['1 handful spinach', '1 banana', '1 apple', '200ml apple juice'], 'drink'),
  S('Mango lassi', '🥭', ['drink', 'smoothie', 'kid-friendly'], ['1 mango', '250g yoghurt', '100ml milk', 'Honey'], 'drink'),
  S('Virgin mojito', '🍃', ['drink', 'mocktail', 'kid-friendly'], ['1 lime', '1 bunch mint', '2 tsp sugar', '300ml soda water'], 'drink'),
  S('Pink lemonade', '🍋', ['drink', 'mocktail', 'kid-friendly'], ['3 lemons', '100g raspberries', '50g sugar', '1 l sparkling water'], 'drink'),
  S('Hot chocolate', '☕', ['drink', 'hot drink', 'kid-friendly'], ['500ml milk', '4 tbsp cocoa', '2 tbsp sugar', 'Marshmallows'], 'drink'),
  S('Classic mojito', '🍹', ['drink', 'cocktail'], ['50ml white rum', '1 lime', '1 bunch mint', '2 tsp sugar', 'Soda water'], 'drink'),
  S('Gin & tonic with cucumber', '🍸', ['drink', 'cocktail'], ['50ml gin', '150ml tonic', '1 cucumber', 'Ice'], 'drink'),
  S('Iced tea with peach', '🧊', ['drink', 'mocktail'], ['4 tea bags', '2 peaches', '1 lemon', 'Honey', 'Ice'], 'drink'),
]

export type SuggestFilter = 'any' | 'dinner' | 'breakfast' | 'lunch' | 'dessert' | 'vegetarian' | 'kid-friendly' | 'drink'

export function matchesFilter(s: Pick<Suggestion, 'tags' | 'kind'>, filter: SuggestFilter): boolean {
  if (filter === 'any') return s.kind === 'food'
  if (filter === 'drink') return s.kind === 'drink'
  return s.kind === 'food' && s.tags.includes(filter)
}

/** Pick a random suggestion, avoiding titles we've just shown or already have. */
export function suggest(filter: SuggestFilter, avoid: string[] = [], random: () => number = Math.random): Suggestion | null {
  const lower = new Set(avoid.map((a) => a.toLowerCase()))
  let pool = SUGGESTIONS.filter((s) => matchesFilter(s, filter) && !lower.has(s.title.toLowerCase()))
  if (!pool.length) pool = SUGGESTIONS.filter((s) => matchesFilter(s, filter))
  if (!pool.length) return null
  return pool[Math.floor(random() * pool.length)]
}
