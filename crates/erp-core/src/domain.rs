//! Small string-backed enums shared by every entity/service. These mirror
//! `src/lib/constants.ts` on the frontend field-for-field -- if you add a
//! variant here, add it there too (and vice versa), or the two sides will
//! silently drift apart on what a "valid" status string is.

use serde::{Deserialize, Serialize};
use std::fmt;

macro_rules! string_enum {
    (
        $(#[$meta:meta])*
        $name:ident { $($variant:ident => $str:literal),+ $(,)? }
    ) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(rename_all = "snake_case")]
        pub enum $name {
            $($variant),+
        }

        impl $name {
            pub fn as_str(&self) -> &'static str {
                match self {
                    $(Self::$variant => $str),+
                }
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(self.as_str())
            }
        }

        impl std::str::FromStr for $name {
            type Err = String;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                match s {
                    $($str => Ok(Self::$variant)),+,
                    other => Err(format!(
                        concat!("invalid ", stringify!($name), ": '{}'"),
                        other
                    )),
                }
            }
        }
    };
}

string_enum!(
    Role {
        Admin => "admin",
        Operator => "operator",
        Viewer => "viewer",
    }
);

impl Role {
    /// Ordinal rank used for "at least this role" checks, mirrors
    /// `ROLE_RANK` in src/lib/constants.ts.
    pub fn rank(&self) -> u8 {
        match self {
            Role::Viewer => 1,
            Role::Operator => 2,
            Role::Admin => 3,
        }
    }

    pub fn has_min_role(&self, min: Role) -> bool {
        self.rank() >= min.rank()
    }
}

string_enum!(
    /// `Return` is deliberately its OWN variant rather than reusing
    /// `Inward`. Both increase the on-hand balance, but they mean different
    /// things in reports: `Inward` is "we manufactured/received this much",
    /// and that figure must stay fixed once recorded. Folding returns into
    /// it made a 20-unit inward read as 23 after a 3-unit return, which is
    /// wrong -- you never inwarded 23. Keeping them separate lets the
    /// product-wise report show Inward | Dispatch | Return as three
    /// independent columns.
    StockMovementType {
        Inward => "inward",
        Outward => "outward",
        Return => "return",
        Adjustment => "adjustment",
    }
);

string_enum!(
    ReelStatus {
        InStock => "in_stock",
        Dispatched => "dispatched",
        Returned => "returned",
        Lost => "lost",
        Damaged => "damaged",
    }
);

string_enum!(
    ReelEventType {
        Created => "created",
        Dispatched => "dispatched",
        Returned => "returned",
        Lost => "lost",
        Damaged => "damaged",
    }
);

string_enum!(
    /// `PartiallyReturned` / `Returned` are set automatically by
    /// `return_service` as returns come in, so a dispatch never sits at
    /// "pending" after its goods have physically come back.
    DispatchStatus {
        Pending => "pending",
        Delivered => "delivered",
        PartiallyReturned => "partially_returned",
        Returned => "returned",
        Cancelled => "cancelled",
    }
);

string_enum!(
    BackupTrigger {
        Manual => "manual",
        Scheduled => "scheduled",
    }
);

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn role_round_trips_through_str() {
        assert_eq!(Role::from_str("admin").unwrap(), Role::Admin);
        assert_eq!(Role::Admin.as_str(), "admin");
        assert!(Role::from_str("nope").is_err());
    }

    #[test]
    fn role_rank_orders_correctly() {
        assert!(Role::Admin.has_min_role(Role::Viewer));
        assert!(Role::Operator.has_min_role(Role::Operator));
        assert!(!Role::Viewer.has_min_role(Role::Admin));
    }
}
