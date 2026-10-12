package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.UserCollectionItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCollectionItemRepository extends JpaRepository<UserCollectionItem, Long> {
    List<UserCollectionItem> findAllByUser_Id(Long userId);

    boolean existsByUser_IdAndItemCode(Long userId, String itemCode);
}
