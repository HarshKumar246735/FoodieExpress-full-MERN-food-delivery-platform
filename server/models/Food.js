'use strict';
const mongoose = require('mongoose');

const { Schema } = mongoose;

const foodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    price: { type: Number, required: true, min: 1 }, // INR
   
discountedPrice: {
  type: Number,
  min: 1,
  default: null,
  validate: {
    validator(v) {
      if (v == null) return true;

      const price =
        typeof this.get === 'function'
          ? this.get('price')
          : this.price;

      return price != null && v < price;
    },
    message: 'Discounted price must be lower than the price',
  },
},


    image: { type: String, default: '' },
    imageCredit: { type: String, default: '' },
    isVeg: { type: Boolean, required: true, index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    prepTime: { type: Number, default: 20, min: 1, max: 120 },
    isAvailable: { type: Boolean, default: true },
    isBestseller: { type: Boolean, default: false, index: true },
    popularity: { type: Number, default: 0, index: true },
    ingredients: { type: [String], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

foodSchema.index({ name: 'text', description: 'text', ingredients: 'text' });
foodSchema.index({ restaurant: 1, category: 1 });
foodSchema.index({ price: 1 });

module.exports = mongoose.models.Food || mongoose.model('Food', foodSchema);
