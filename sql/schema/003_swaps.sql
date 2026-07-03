CREATE TABLE IF NOT EXISTS swaps
(
    slot                UInt64,
    block_time          DateTime('UTC'),
    tx_signature        String,
    instruction_index   UInt16,
    inner_index         Nullable(UInt16),
    dex                 LowCardinality(String),
    program_id          LowCardinality(String),
    pool_address        String,
    trader              String,
    mint_in             String,
    mint_out            String,
    amount_in_raw       UInt64,
    amount_out_raw      UInt64,
    amount_in_ui        Float64,
    amount_out_ui       Float64,
    decimals_in         Nullable(UInt8),
    decimals_out        Nullable(UInt8)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(block_time)
ORDER BY (dex, pool_address, block_time);
