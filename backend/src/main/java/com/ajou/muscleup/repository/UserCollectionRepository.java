package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.UserCollection;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserCollectionRepository extends JpaRepository<UserCollection, Long> {
    Optional<UserCollection> findByUser_Id(Long userId);

    /** 상자 · 조각을 바꾸기 전에 잠그고 읽는다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from UserCollection c where c.user.id = :userId")
    Optional<UserCollection> findForUpdate(@Param("userId") Long userId);
}
