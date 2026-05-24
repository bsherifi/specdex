//! Identity stub repo. §17 v1 — single-row table, no auth.

use chrono::DateTime;
use chrono::Utc;
use rusqlite::OptionalExtension;

use crate::db::Db;
use crate::events::EventBus;
use crate::models::event::Event;
use crate::models::identity::Identity;
use crate::{CoreError, Result};

pub struct IdentityRepo<'db> {
    db: &'db Db,
    events: &'db EventBus,
}

impl<'db> IdentityRepo<'db> {
    pub fn new(db: &'db Db, events: &'db EventBus) -> Self {
        Self { db, events }
    }

    pub fn get(&self) -> Result<Option<Identity>> {
        self.db.with(|conn| {
            let row = conn
                .query_row(
                    "SELECT display_name, created_at FROM identity WHERE id = 1",
                    [],
                    |row| {
                        let name: String = row.get(0)?;
                        let created_at: String = row.get(1)?;
                        Ok((name, created_at))
                    },
                )
                .optional()?;
            match row {
                None => Ok(None),
                Some((name, ts)) => {
                    let created_at: DateTime<Utc> = ts
                        .parse::<DateTime<Utc>>()
                        .map_err(|e| CoreError::Db(format!("invalid identity.created_at: {e}")))?;
                    Ok(Some(Identity {
                        display_name: name,
                        created_at,
                    }))
                }
            }
        })
    }

    /// Upsert. Validates the name, then writes (id=1).
    pub fn set(&self, display_name: &str) -> Result<Identity> {
        let new = Identity::new(display_name).map_err(CoreError::IdentityValidation)?;
        let created_at = new.created_at.to_rfc3339();
        self.db.with_mut(|conn| {
            conn.execute(
                "INSERT INTO identity (id, display_name, created_at) VALUES (1, ?1, ?2)
                 ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name",
                (&new.display_name, &created_at),
            )?;
            Ok(())
        })?;
        self.events.emit(Event::IdentityUpdated);
        Ok(new)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh() -> (Db, EventBus) {
        (Db::open_memory().unwrap(), EventBus::new())
    }

    #[test]
    fn get_returns_none_on_fresh_db() {
        let (db, ev) = fresh();
        let repo = IdentityRepo::new(&db, &ev);
        assert!(repo.get().unwrap().is_none());
    }

    #[test]
    fn set_then_get_round_trips() {
        let (db, ev) = fresh();
        let repo = IdentityRepo::new(&db, &ev);
        let saved = repo.set("Sara Chen").unwrap();
        let loaded = repo.get().unwrap().unwrap();
        assert_eq!(loaded.display_name, saved.display_name);
    }

    #[test]
    fn set_rejects_empty_name() {
        let (db, ev) = fresh();
        let repo = IdentityRepo::new(&db, &ev);
        let err = repo.set("   ").unwrap_err();
        assert!(matches!(err, CoreError::IdentityValidation(_)));
    }

    #[test]
    fn set_overwrites_existing() {
        let (db, ev) = fresh();
        let repo = IdentityRepo::new(&db, &ev);
        repo.set("First").unwrap();
        repo.set("Second").unwrap();
        let loaded = repo.get().unwrap().unwrap();
        assert_eq!(loaded.display_name, "Second");
    }
}
