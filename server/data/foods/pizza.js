'use strict';
// [name, price, discountedPrice(0=none), veg 'V'|'N', prepMin, restaurantKey, description, ingredients]
const PH = 'pizza-house', UC = 'urban-cafe', HH = 'healthy-harvest';
module.exports = [
  ['Margherita Pizza', 199, 0, 'V', 20, PH, 'The classic: tomato sauce, fresh mozzarella and basil on a thin hand-stretched base.', 'pizza dough, tomato sauce, mozzarella, basil'],
  ['Farmhouse Pizza', 299, 249, 'V', 22, PH, 'Loaded with onion, capsicum, mushroom and sweet corn under a blanket of cheese.', 'onion, capsicum, mushroom, sweet corn, mozzarella'],
  ['Peppy Paneer Pizza', 319, 0, 'V', 22, PH, 'Spiced paneer cubes with crunchy capsicum and red paprika.', 'paneer, capsicum, red paprika, mozzarella'],
  ['Veggie Supreme Pizza', 329, 0, 'V', 22, PH, 'Black olives, jalapenos, onion, capsicum and tomato for a full garden of flavour.', 'black olives, jalapeno, onion, capsicum, tomato'],
  ['Four Cheese Pizza', 379, 0, 'V', 24, PH, 'Mozzarella, cheddar, parmesan and processed cheese melted together.', 'mozzarella, cheddar, parmesan, cheese blend'],
  ['Mexican Green Wave Pizza', 339, 289, 'V', 22, PH, 'Mexican herbs, jalapenos and green capsicum on a tangy salsa base.', 'jalapeno, capsicum, onion, mexican herbs, salsa'],
  ['Tandoori Paneer Pizza', 349, 0, 'V', 24, PH, 'Tandoori-marinated paneer and onion with a smoky mint drizzle.', 'tandoori paneer, onion, capsicum, mint sauce'],
  ['Double Cheese Pizza', 289, 0, 'V', 20, PH, 'Twice the mozzarella on a classic tomato base.', 'double mozzarella, tomato sauce'],
  ['Corn and Cheese Pizza', 259, 0, 'V', 20, UC, 'Sweet corn kernels and stretchy cheese, a kid favourite.', 'sweet corn, mozzarella, tomato sauce'],
  ['Mushroom Pizza', 279, 0, 'V', 22, UC, 'Sauteed button mushrooms with garlic and herbs.', 'button mushroom, garlic, oregano, mozzarella'],
  ['Peri Peri Pizza', 309, 0, 'V', 22, PH, 'Peri peri sauce, paneer and onion for a spicy kick.', 'peri peri sauce, paneer, onion, capsicum'],
  ['BBQ Paneer Pizza', 339, 0, 'V', 24, PH, 'Smoky barbecue sauce with paneer, onion and capsicum.', 'bbq sauce, paneer, onion, capsicum, mozzarella'],
  ['Mediterranean Pizza', 369, 0, 'V', 24, UC, 'Olives, sun-dried tomato, feta and zucchini with oregano.', 'olives, sun-dried tomato, feta, zucchini, oregano'],
  ['Spinach and Corn Pizza', 289, 0, 'V', 22, HH, 'Wilted spinach and sweet corn on a whole-wheat base.', 'spinach, sweet corn, whole wheat dough, mozzarella'],
  ['Classic Neapolitan Pizza', 349, 299, 'V', 20, PH, 'Soft, blistered crust with San Marzano-style tomato and fior di latte.', 'tomato, mozzarella, basil, olive oil'],
  ['Thin Crust Garden Pizza', 299, 0, 'V', 20, HH, 'Cracker-thin crust topped with seasonal vegetables.', 'thin crust, zucchini, bell pepper, tomato, mozzarella'],
  ['Garlic Cheese Pizza', 269, 0, 'V', 20, PH, 'Garlic butter base with molten cheese and herbs.', 'garlic butter, mozzarella, parsley'],
  ['Spicy Veg Pizza', 279, 0, 'V', 22, PH, 'Fiery chilli flakes with onion, capsicum and jalapeno.', 'chilli flakes, onion, capsicum, jalapeno'],
  ['Pesto Pizza', 369, 0, 'V', 22, UC, 'Basil pesto base with cherry tomato and mozzarella.', 'basil pesto, cherry tomato, mozzarella, pine nuts'],
  ['Loaded Cheese Pizza', 399, 349, 'V', 24, PH, 'A cheese lover\'s pizza with a cheesy-burst crust.', 'mozzarella, cheddar, cheese burst crust'],
  ['Chicken Tikka Pizza', 379, 0, 'N', 24, PH, 'Tandoori chicken tikka, onion and green chilli over cheese.', 'chicken tikka, onion, green chilli, mozzarella'],
  ['Pepperoni Pizza', 419, 0, 'N', 22, PH, 'Spicy chicken pepperoni slices on mozzarella.', 'chicken pepperoni, mozzarella, tomato sauce'],
];
