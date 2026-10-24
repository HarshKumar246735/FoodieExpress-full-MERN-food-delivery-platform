import { createContext, useContext } from 'react';

/** { restaurants, restaurantId, restaurant, reload } supplied by OwnerApp to every owner page. */
export const OwnerContext = createContext({ restaurants: [], restaurantId: '', restaurant: null, reload: () => {} });
export const useOwner = () => useContext(OwnerContext);

/** Query params that scope every owner API call to the selected restaurant. */
export const scope = (restaurantId, extra = {}) => ({ ...(restaurantId ? { restaurant: restaurantId } : {}), ...extra });
