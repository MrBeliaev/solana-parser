CREATE TABLE IF NOT EXISTS pools
(
    pool_address            String,
    dex                     LowCardinality(String),
    program_id              LowCardinality(String),
    base_mint               String,
    quote_mint              String,
    created_slot            UInt64,
    created_block_time      DateTime('UTC'),
    created_tx_signature    String
)
ENGINE = ReplacingMergeTree
ORDER BY (pool_address);
