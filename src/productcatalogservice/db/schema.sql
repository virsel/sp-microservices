CREATE TABLE IF NOT EXISTS products (
                                        id SERIAL PRIMARY KEY,
                                        name TEXT,
                                        description TEXT,
                                        price__currency_code TEXT,
                                        price__units BIGINT,
                                        price__nanos INTEGER,
    categories TEXT[]
    );
