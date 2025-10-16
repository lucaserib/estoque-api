// src/types/mercadolivre.ts

import { JsonValue } from "@prisma/client/runtime/library";

export interface MLAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface MLUserInfo {
  id: number;
  nickname: string;
  registration_date: string;
  first_name: string;
  last_name: string;
  country_id: string;
  email: string;
  identification: {
    type: string;
    number: string;
  };
  address: {
    state: string;
    city: string;
  };
  phone: {
    area_code: string;
    number: string;
    extension: string;
    verified: boolean;
  };
  alternative_phone: {
    area_code: string;
    number: string;
    extension: string;
  };
  user_type: string;
  tags: string[];
  logo: string | null;
  points: number;
  site_id: string;
  permalink: string;
  seller_reputation: {
    level_id: string;
    power_seller_status: string;
    transactions: {
      period: string;
      total: number;
      completed: number;
      canceled: number;
      ratings: {
        positive: number;
        negative: number;
        neutral: number;
      };
    };
  };
  status: {
    site_status: string;
    list: {
      allow: boolean;
      codes: string[];
    };
    buy: {
      allow: boolean;
      codes: string[];
    };
    sell: {
      allow: boolean;
      codes: string[];
    };
    billing: {
      allow: boolean;
      codes: string[];
    };
    mercadopago_tc_accepted: boolean;
    mercadopago_account_type: string;
    mercadoenvios: string;
    immediate_payment: boolean;
  };
}

export interface MLItem {
  id: string;
  title: string;
  category_id: string;
  seller_custom_field?: string;
  price: number;
  base_price: number;
  original_price: number | null;
  currency_id: string;
  initial_quantity: number;
  available_quantity: number;
  sold_quantity: number;
  sale_terms: Array<{
    id: string;
    name: string;
    value_id: string;
    value_name: string;
    value_struct: Record<string, unknown> | null;
    values: Array<{
      id: string;
      name: string;
      struct: Record<string, unknown> | null;
    }>;
  }>;
  buying_mode: string;
  listing_type_id: string;
  start_time: string;
  stop_time: string;
  condition: string;
  permalink: string;
  thumbnail_id: string;
  thumbnail: string;
  secure_thumbnail: string;
  pictures: Array<{
    id: string;
    url: string;
    secure_url: string;
    size: string;
    max_size: string;
    quality: string;
  }>;
  video_id: string | null;
  descriptions: Array<{
    id: string;
  }>;
  accepts_mercadopago: boolean;
  non_mercado_pago_payment_methods: unknown[];
  shipping: {
    mode: string;
    methods: unknown[];
    tags: string[];
    dimensions: string | null;
    local_pick_up: boolean;
    free_shipping: boolean;
    logistic_type: string;
    store_pick_up: boolean;
  };
  international_delivery_mode: string;
  seller_address: {
    city: {
      id: string;
      name: string;
    };
    state: {
      id: string;
      name: string;
    };
    country: {
      id: string;
      name: string;
    };
    search_location: {
      neighborhood: {
        id: string;
        name: string;
      };
      city: {
        id: string;
        name: string;
      };
      state: {
        id: string;
        name: string;
      };
    };
    id: number;
  };
  seller_contact: Record<string, unknown> | null;
  location: Record<string, unknown> | null;
  coverage_areas: unknown[];
  attributes?: Array<{
    id: string;
    name: string;
    value_id: string | null;
    value_name: string | null;
    value_struct: Record<string, unknown> | null;
    values: Array<{
      id: string;
      name: string;
      struct: Record<string, unknown> | null;
    }>;
    attribute_group_id: string;
    attribute_group_name: string;
  }>;
  warnings: unknown[];
  listing_source: string;
  variations?: Array<{
    id: number;
    attribute_combinations: Array<{
      id: string;
      name: string;
      value_id: string | null;
      value_name: string | null;
      value_struct: any;
    }>;
    price: number;
    available_quantity: number;
    sold_quantity: number;
    picture_ids: string[];
    seller_custom_field: string | null;
    catalog_product_id: string | null;
    attributes?: Array<{
      id: string;
      name: string;
      value_id: string | null;
      value_name: string | null;
      value_struct: Record<string, unknown> | null;
    }>;
  }>;
  status: "active" | "paused" | "closed" | "under_review" | "inactive";
  sub_status: unknown[];
  tags: string[];
  warranty: string;
  catalog_product_id: string | null;
  domain_id: string;
  parent_item_id: string | null;
  differential_pricing: Record<string, unknown> | null;
  deal_ids: unknown[];
  automatic_relist: boolean;
  date_created: string;
  last_updated: string;
  health: number;
  catalog_listing: boolean;
}

export interface MLItemsResponse {
  seller_id: number;
  paging: {
    total: number;
    primary_results: number;
    offset: number;
    limit: number;
  };
  results: string[]; // Array de IDs dos items
  orders: Array<{
    id: string;
    name: string;
  }>;
  available_orders: Array<{
    id: string;
    name: string;
  }>;
}

export interface MLError {
  message: string;
  error: string;
  status: number;
  cause: unknown[];
}

export interface MercadoLivreAccount {
  id: string;
  userId: string;
  mlUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  nickname: string;
  siteId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MercadoLivreAccountWithDetails extends MercadoLivreAccount {
  userInfo?: {
    id: number;
    nickname: string;
    firstName: string;
    lastName: string;
    email: string;
    countryId: string;
    siteId: string;
    userType: string;
    points: number;
    permalink: string;
    logo: string | null;
    registrationDate: string;
    sellerReputation?: {
      levelId?: string;
      powerSellerStatus?: string;
      transactions?: {
        period: string;
        total: number;
        completed: number;
        canceled: number;
        ratings: {
          positive: number;
          negative: number;
          neutral: number;
        };
      };
    };
    status?: Record<string, unknown>;
  };
}

export interface ProdutoMercadoLivre {
  id: string;
  produtoId: string;
  mercadoLivreAccountId: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlOriginalPrice?: number | null; // ✅ NOVO: Preço original antes da promoção
  mlBasePrice?: number | null; // ✅ NOVO: Preço base do produto
  mlHasPromotion?: boolean; // ✅ NOVO: Se tem promoção ativa
  mlPromotionDiscount?: number | null; // ✅ NOVO: Percentual de desconto
  mlAvailableQuantity: number;
  mlStatus: string;
  mlPermalink?: string;
  mlThumbnail?: string;
  mlCategoryId?: string;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
  produto?: {
    id: string;
    nome: string;
    sku: string;
  };
}

export interface MLSyncResult {
  success: boolean;
  totalItems: number;
  syncedItems: number;
  errors: string[];
  newItems: number;
  updatedItems: number;
  errorItems: number;
  duration?: number;
  syncHistoryId?: string;
}

export interface MercadoLivreSyncHistory {
  id: string;
  mercadoLivreAccountId: string;
  syncType: string;
  status: string;
  totalItems: number;
  syncedItems: number;
  newItems: number;
  updatedItems: number;
  errorItems: number;
  errors: JsonValue;
  startedAt: Date;
  completedAt?: Date | null;
  duration?: number | null;
}

export interface MercadoLivreWebhook {
  id: string;
  mercadoLivreAccountId: string;
  mlNotificationId: string;
  resource: string;
  userId: string;
  topic: string;
  applicationId: string;
  attempts: number;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  receivedAt: Date;
}

export interface MLCategory {
  id: string;
  name: string;
  picture?: string;
  permalink?: string;
  total_items_in_this_category?: number;
  path_from_root?: Array<{
    id: string;
    name: string;
  }>;
  children_categories?: Array<{
    id: string;
    name: string;
    total_items_in_this_category: number;
  }>;
  attribute_types?: string;
  settings?: {
    adult_content: boolean;
    buying_allowed: boolean;
    buying_modes: string[];
    catalog_domain?: string;
    coverage_areas?: string;
    currencies: string[];
    fragile: boolean;
    immediate_payment?: string;
    item_conditions: string[];
    items_reviews_allowed: boolean;
    listing_allowed: boolean;
    max_description_length: number;
    max_pictures_per_item: number;
    max_pictures_per_item_var: number;
    max_sub_title_length: number;
    max_title_length: number;
    maximum_price?: number;
    minimum_price?: number;
    mirror_category?: string;
    mirror_master_category?: string;
    mirror_slave_categories?: string[];
    price?: string;
    reservation_allowed?: string;
    restrictions?: unknown[];
    rounded_address: boolean;
    seller_contact?: string;
    shipping_modes: string[];
    shipping_options: string[];
    shipping_profile?: string;
    show_contact_information: boolean;
    simple_shipping?: string;
    stock?: string;
    sub_vertical?: string;
    subscribable: boolean;
    tags: string[];
    vertical?: string;
    vip_subdomain?: string;
  };
}

export interface MLSearchFilters {
  category?: string;
  status?: "active" | "paused" | "closed" | "under_review" | "inactive";
  condition?: "new" | "used";
  listing_type?: string;
  sort?: "price_asc" | "price_desc" | "relevance" | "date_desc" | "date_asc";
  offset?: number;
  limit?: number;
}

export interface MLItemUpdate {
  title?: string;
  price?: number;
  available_quantity?: number;
  status?: "active" | "paused" | "closed";
  condition?: "new" | "used";
  listing_type_id?: string;
  pictures?: Array<{
    source: string;
  }>;
  attributes?: Array<{
    id: string;
    value_name?: string;
    value_id?: string;
  }>;
  shipping?: {
    mode: string;
    local_pick_up?: boolean;
    free_shipping?: boolean;
    methods?: unknown[];
    dimensions?: string;
    tags?: string[];
  };
}

export interface MLOrder {
  id: string;
  status: string;
  status_detail?: string;
  date_created: string;
  date_closed?: string;
  order_items: Array<{
    item: {
      id: string;
      title: string;
      category_id?: string;
      seller_custom_field?: string;
      thumbnail?: string;
      price?: number;
    };
    quantity: number;
    unit_price: number;
    full_unit_price?: number;
  }>;
  buyer: Record<string, unknown>;
  seller: Record<string, unknown>;
  currency_id: string;
  order_request?: {
    return?: string;
    change?: number;
  };
  shipping: Record<string, unknown>;
  total_amount: number;
  paid_amount?: number;
  payments?: unknown;
  feedback?: {
    purchase?: {
      id: string;
      rating: string;
      message: string | null;
    };
    sale?: {
      id: string;
      rating: string;
      message: string | null;
    };
  };
  context?: {
    channel: string;
    site_name: string;
  };
}
