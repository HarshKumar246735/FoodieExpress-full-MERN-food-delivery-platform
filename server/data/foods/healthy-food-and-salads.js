'use strict';
// [name, price, discountedPrice(0=none), veg 'V'|'N', prepMin, restaurantKey, description, ingredients]
const GB = 'green-bowl', HH = 'healthy-harvest';
module.exports = [
  ['Greek Salad', 199, 0, 'V', 10, GB, 'Cucumber, tomato, olives, onion and feta with an oregano dressing.', 'cucumber, tomato, olives, feta, red onion, olive oil'],
  ['Caesar Salad with Grilled Chicken', 249, 0, 'N', 14, GB, 'Romaine, parmesan and croutons with grilled chicken and Caesar dressing.', 'romaine, grilled chicken, parmesan, croutons, caesar dressing'],
  ['Quinoa Buddha Bowl', 279, 229, 'V', 15, GB, 'Quinoa with roasted vegetables, chickpeas, avocado and tahini.', 'quinoa, sweet potato, chickpeas, avocado, tahini'],
  ['Chickpea Power Bowl', 249, 0, 'V', 14, GB, 'Spiced chickpeas, brown rice, greens and lemon yoghurt dressing.', 'chickpeas, brown rice, spinach, cucumber, yoghurt'],
  ['Paneer Tikka Salad Bowl', 259, 0, 'V', 15, GB, 'Grilled paneer over greens, quinoa and mint-yoghurt dressing.', 'paneer, mixed greens, quinoa, cherry tomato, mint yoghurt'],
  ['Grilled Chicken Salad', 269, 0, 'N', 15, HH, 'Herb-grilled chicken breast on crisp greens with lemon vinaigrette.', 'chicken breast, lettuce, cucumber, cherry tomato, vinaigrette'],
  ['Sprouts Salad', 149, 0, 'V', 8, HH, 'Mixed sprouts with onion, tomato, lemon and chaat masala.', 'moong sprouts, onion, tomato, lemon, chaat masala'],
  ['Avocado Toast', 199, 0, 'V', 10, GB, 'Multigrain toast with smashed avocado, chilli flakes and seeds.', 'multigrain bread, avocado, lemon, chilli flakes, seeds'],
  ['Hummus Veggie Wrap', 189, 0, 'V', 10, GB, 'Whole-wheat wrap with hummus, grilled vegetables and greens.', 'whole wheat wrap, hummus, zucchini, bell pepper, lettuce'],
  ['Falafel Wrap', 199, 0, 'V', 12, GB, 'Crisp falafel with tahini, pickles and salad in a warm wrap.', 'falafel, tahini, pickled onion, lettuce, wrap'],
  ['Grilled Chicken Wrap', 229, 0, 'N', 12, GB, 'Grilled chicken, crunchy salad and garlic yoghurt in a whole-wheat wrap.', 'grilled chicken, lettuce, tomato, garlic yoghurt, wrap'],
  ['Oats and Fruit Bowl', 149, 0, 'V', 8, HH, 'Overnight oats with seasonal fruit, honey and chia seeds.', 'rolled oats, milk, seasonal fruit, honey, chia seeds'],
  ['Greek Yoghurt Parfait', 159, 0, 'V', 6, HH, 'Layers of thick yoghurt, granola, berries and honey.', 'greek yoghurt, granola, mixed berries, honey'],
  ['Teriyaki Salmon Bowl', 399, 349, 'N', 20, GB, 'Teriyaki-glazed salmon with brown rice, edamame and sesame.', 'salmon, brown rice, edamame, cucumber, teriyaki sauce'],
  ['Millet Khichdi Bowl', 169, 0, 'V', 18, HH, 'Comforting foxtail millet and moong dal khichdi with ghee.', 'foxtail millet, moong dal, vegetables, ghee, turmeric'],
  ['Brown Rice Veg Bowl', 179, 0, 'V', 14, HH, 'Brown rice with sauteed seasonal vegetables and a light soy glaze.', 'brown rice, broccoli, carrot, beans, soy sauce'],
  ['Egg White Omelette', 149, 0, 'N', 10, HH, 'High-protein egg white omelette with spinach and mushroom.', 'egg whites, spinach, mushroom, black pepper'],
  ['Moong Dal Chilla', 119, 0, 'V', 12, HH, 'Protein-rich savoury moong dal pancakes with mint chutney.', 'moong dal, ginger, green chilli, coriander, mint chutney'],
  ['Tofu Stir-Fry Bowl', 239, 0, 'V', 15, GB, 'Crisp tofu and vegetables stir-fried with garlic and sesame.', 'tofu, broccoli, bell pepper, garlic, sesame oil'],
  ['Mediterranean Pasta Salad', 219, 0, 'V', 14, GB, 'Whole-wheat pasta with olives, sun-dried tomato and basil pesto.', 'whole wheat pasta, olives, sun-dried tomato, pesto, parmesan'],
  ['Multigrain Roasted Veg Sandwich', 169, 0, 'V', 10, HH, 'Roasted vegetables, hummus and rocket in toasted multigrain bread.', 'multigrain bread, roasted vegetables, hummus, rocket'],
  ['Zucchini Noodles with Pesto', 249, 0, 'V', 14, GB, 'Spiralised zucchini tossed in basil pesto with cherry tomatoes.', 'zucchini, basil pesto, cherry tomato, pine nuts'],
  ['Fruit Chaat Bowl', 129, 0, 'V', 6, HH, 'Seasonal fruits tossed with a squeeze of lime and chaat masala.', 'seasonal fruit, lime, chaat masala'],
  ['Corn and Black Bean Salad', 179, 0, 'V', 10, GB, 'Sweet corn, black beans, peppers and avocado with lime dressing.', 'sweet corn, black beans, bell pepper, avocado, lime'],
];
