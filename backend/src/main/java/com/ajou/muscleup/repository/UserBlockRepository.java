package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.UserBlock;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {
    Optional<UserBlock> findByBlocker_IdAndBlocked_Id(Long blockerId, Long blockedId);

    List<UserBlock> findAllByBlocker_IdOrderByCreatedAtDesc(Long blockerId);

    /** 내가 차단했거나 나를 차단한 사람 id */
    @Query("""
      select case when b.blocker.id = :me then b.blocked.id else b.blocker.id end
      from UserBlock b where b.blocker.id = :me or b.blocked.id = :me
      """)
    List<Long> findHiddenUserIds(@Param("me") Long me);

    @Query("""
      select count(b) > 0 from UserBlock b
      where (b.blocker.id = :a and b.blocked.id = :b) or (b.blocker.id = :b and b.blocked.id = :a)
      """)
    boolean existsEitherWay(@Param("a") Long a, @Param("b") Long b);
}
